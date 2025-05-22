/**
 * Creates an interactive Ridgeline Plot showing the distribution of Total Stats
 * for a selected Generation, controlled by a slider and an animation play button.
 * @param {Array<Object>} data - The processed Pokemon dataset. Each object is expected
 * to have `Generation` and `Total` properties.
 * @param {string} containerId - The CSS selector for the HTML div where the chart will be rendered.
 */
export function createRidgelinePlot(data, containerId) {
    const mainContainer = d3.select(containerId);
    mainContainer.html(""); // Clear previous content

    // --- Flexbox layout for mainContainer ---
    mainContainer
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("height", "100%"); // Ensure mainContainer tries to use full available height

    // --- Title and Indicator Wrapper (Above Chart) ---
    const titleIndicatorWrapper = mainContainer.append("div")
        .attr("class", "ridgeline-title-indicator-wrapper")
        .style("padding", "5px 0px 5px 5px") // Adjusted padding
        .style("text-align", "center")
        .style("display", "flex")
        .style("justify-content", "center")
        .style("align-items", "center")
        .style("flex-shrink", "0"); // Prevent shrinking

    titleIndicatorWrapper.append("h3")
        .attr("class", "ridgeline-chart-title")
        .style("font-size", "14px")
        .style("text-decoration", "underline")
        .style("margin", "0 15px 0 0")
        .text("Distribution of Total Stats by Generation");

    const generationIndicator = titleIndicatorWrapper.append("div")
        .attr("class", "generation-indicator")
        .style("font-size", "1.0em")
        .style("font-weight", "bold");

    // --- Chart Area (SVG) ---
    const chartContainer = mainContainer.append("div")
        .attr("class", "ridgeline-chart-area")
        .style("width", "100%")
        .style("flex-grow", "1") // Allow chart area to grow and take available space
        .style("min-height", "0") // Important for flex-grow with potentially overflowing content
        .style("position", "relative"); // For positioning SVG if needed, and good practice

    // --- Controls Container (Below Chart) ---
    const controlsContainer = mainContainer.append("div")
        .attr("class", "ridgeline-controls-bottom")
        .style("padding", "5px")
        .style("display", "flex") // Use flexbox for layout
        .style("flex-direction", "column") // Stack slider and button vertically
        .style("align-items", "center") // Center items horizontally
        .style("gap", "10px") // Space between slider container and button
        .style("flex-shrink", "0"); 

    const BORDER_BOX_PADDING = 0; 
    let currentWidth = chartContainer.node().clientWidth - (BORDER_BOX_PADDING * 2);
    let currentHeight = chartContainer.node().clientHeight - (BORDER_BOX_PADDING * 2);

    if (currentWidth <=0 || currentHeight <= 0) {
        currentWidth = Math.max(currentWidth, 200); 
        currentHeight = Math.max(currentHeight, 150); 
    }

    const margin = {top: 10, right: 30, bottom: 50, left: 70};
    let width = Math.max(10, currentWidth - margin.left - margin.right);
    let height = Math.max(10, currentHeight - margin.top - margin.bottom);

    const svg = chartContainer.append("svg")
        .attr("viewBox", `0 0 ${currentWidth} ${currentHeight}`) 
        .attr("preserveAspectRatio", "xMidYMid meet")
        .style("width", "100%") 
        .style("height", "100%")
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const generations = [...new Set(data.map(d => d.Generation))]
                         .filter(g => !isNaN(g))
                         .sort((a, b) => a - b)
                         .map(String);

    const dataByGenArray = generations.map(genKey => {
        const genValues = data.filter(d => String(d.Generation) === genKey && !isNaN(d.Total));
        return {
            key: genKey,
            values: genValues || []
        };
    }).filter(d => d.values.length > 0);


    if (dataByGenArray.length === 0) {
        svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor","middle").text("No valid generation data.");
        generationIndicator.text("No data to display.");
        if (controlsContainer) controlsContainer.style("display", "none"); 
        return;
    }

    const totalExtent = d3.extent(data, d => d.Total);
    if (totalExtent[0] === undefined || isNaN(totalExtent[0])) {
         svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor","middle").text("Invalid 'Total' stat data.");
         if (controlsContainer) controlsContainer.style("display", "none");
         return;
    }
    const xScale = d3.scaleLinear().domain(totalExtent).range([0, width]).nice();
    const yDensityScale = d3.scaleLinear().range([height, 0]);

    function kernelDensityEstimator(kernel, X) {
      return function(V) { return X.map(x => [x, d3.mean(V, v => kernel(x - v))]); }
    }
    function kernelEpanechnikov(k) {
      return function(v) { return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0; };
    }
    const kde = kernelDensityEstimator(kernelEpanechnikov(20), xScale.ticks(80));

    const areaGenerator = d3.area()
        .curve(d3.curveBasis)
        .x(p => xScale(p[0]))
        .y0(height)
        .y1(p => yDensityScale(p[1]));

    const xAxis = d3.axisBottom(xScale).ticks(Math.max(2, Math.floor(width / 80)));
    svg.append("g").attr("class", "x-axis").attr("transform", `translate(0, ${height})`).call(xAxis);
    const yAxisGroup = svg.append("g").attr("class", "y-axis");

    svg.append("text").attr("class", "axis-label").attr("x", width / 2).attr("y", height + margin.bottom - 10).style("text-anchor", "middle").text("Total Stats");
    svg.append("text").attr("class", "axis-label axis-label-y")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2).attr("y", -margin.left + 20)
        .style("text-anchor", "middle").text("Number of Pokémon");

    const animatedPath = svg.append("path")
        .attr("class", "animated-density-area")
        .style("fill-opacity", 0.7)
        .style("stroke", "#333")
        .style("stroke-width", "1px");

    // --- Slider and Play Button Styling ---
    const sliderContainer = controlsContainer.append("div")
        .style("width", "100%") 
        .style("max-width", "450px"); 

    const slider = sliderContainer.append("input")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", dataByGenArray.length > 0 ? dataByGenArray.length - 1 : 0)
        .attr("value", 0)
        .attr("step", 1)
        .style("width", "100%")
        .style("cursor", "pointer");

    const playButton = controlsContainer.append("button")
        .text("Play Animation")
        .style("padding", "8px 15px")
        .style("font-size", "0.9em")
        .style("color", "#fff")
        .style("background-color", "#007bff") 
        .style("border", "none")
        .style("border-radius", "5px")
        .style("cursor", "pointer")
        .style("transition", "background-color 0.2s ease-in-out");

    playButton.on("mouseover", function() {
        if (isPlaying && playButton.text() === "Pause") {
            d3.select(this).style("background-color", "#42474c"); // Darker grey for pause hover
        } else if (!isPlaying && playButton.text() === "Replay") {
            d3.select(this).style("background-color", "#1e7e34"); // Darker green for replay hover
        }
         else {
            d3.select(this).style("background-color", "#0056b3"); 
        }
    }).on("mouseout", function() {
        if (isPlaying && playButton.text() === "Pause") {
             d3.select(this).style("background-color", "#5a6268"); // Restore pause color
        } else if (!isPlaying && playButton.text() === "Replay") {
             d3.select(this).style("background-color", "#28a745"); // Restore replay color
        } else {
             d3.select(this).style("background-color", "#007bff"); // Restore play color
        }
    });


    let animationTimer = null;
    let isPlaying = false;
    let currentAnimationGenerationIndex = 0;
    const animationInterval = 1000;

    function updateToGeneration(generationIdx, isAnimatedOrInitial = false) {
        if (generationIdx < 0 || generationIdx >= dataByGenArray.length) {
            return;
        }

        const generationData = dataByGenArray[generationIdx];
        generationIndicator.html(`Selected Generation: <span style="color: ${d3.schemeCategory10[generationIdx % 10]}">${generationData.key}</span>`);

        const genTotals = generationData.values.map(p => p.Total).filter(val => !isNaN(val));
        let density = [];
        if (genTotals.length >= 2) {
            density = kde(genTotals);
        }
        
        const maxDensity = d3.max(density, p => p[1]);
        const yDomainMax = (maxDensity && maxDensity > 0) ? maxDensity : 1e-6;
        yDensityScale.domain([0, yDomainMax]).nice();

        const N_valid_points = genTotals.length;
        const nicedMaxDensity = yDensityScale.domain()[1];
        let tickDisplayMultiplier;
        if (N_valid_points === 0) {
          tickDisplayMultiplier = 0;
        } else if (nicedMaxDensity > 0) {
          tickDisplayMultiplier = N_valid_points / nicedMaxDensity;
        } else {
          tickDisplayMultiplier = N_valid_points;
        }
        
        const transitionDuration = isAnimatedOrInitial ? (generationIdx === 0 && !isPlaying && !animationTimer ? 0 : 750) : 200;

        yAxisGroup.transition().duration(transitionDuration / 2)
            .call(d3.axisLeft(yDensityScale).ticks(5).tickFormat(t => {
                const scaledValue = t * tickDisplayMultiplier;
                return d3.format(".0f")(Math.abs(scaledValue) < 1e-9 ? 0 : scaledValue);
            }));
        
        animatedPath
            .datum(density.filter(p => !isNaN(p[0]) && !isNaN(p[1])))
            .transition()
            .duration(transitionDuration)
            .ease(d3.easeLinear)
            .attr("d", areaGenerator)
            .style("fill", d3.schemeCategory10[generationIdx % 10]);
    }
    
    function runAnimationStep() {
        if (currentAnimationGenerationIndex >= dataByGenArray.length) {
            pauseAnimation(); // This will set text to Replay and appropriate color
            return;
        }
        slider.property("value", currentAnimationGenerationIndex);
        updateToGeneration(currentAnimationGenerationIndex, true);
        currentAnimationGenerationIndex++;
    }

    function playAnimation() {
        if (dataByGenArray.length === 0) return;
        isPlaying = true;
        playButton.text("Pause").style("background-color", "#5a6268"); 
        
        // If animation is started from a specific slider position, sync it
        if (currentAnimationGenerationIndex !== +slider.property("value")) {
            currentAnimationGenerationIndex = +slider.property("value");
        }
        // If at the end and "Replay" was effectively clicked (isPlaying was false, now true)
        if (currentAnimationGenerationIndex >= dataByGenArray.length) {
            currentAnimationGenerationIndex = 0;
            slider.property("value", 0);
        }

        runAnimationStep(); 
        animationTimer = d3.interval(runAnimationStep, animationInterval);
    }

    function pauseAnimation() {
        isPlaying = false;
        if (animationTimer) animationTimer.stop();
        animationTimer = null;
        if (currentAnimationGenerationIndex >= dataByGenArray.length && dataByGenArray.length > 0) {
            playButton.text("Replay").style("background-color", "#28a745"); 
        } else {
            playButton.text("Play Animation").style("background-color", "#007bff"); 
        }
    }

    slider.on("input", function() {
        if (isPlaying) {
            pauseAnimation(); 
        }
        currentAnimationGenerationIndex = +this.value; 
        updateToGeneration(+this.value, false);
    });

    playButton.on("click", () => {
        if (isPlaying) {
            pauseAnimation();
        } else { 
            // If "Replay" was showing, currentAnimationGenerationIndex would be at the end.
            // playAnimation() will handle resetting it if it's at the end.
            playAnimation();
        }
    });

    if (dataByGenArray.length > 0) {
        updateToGeneration(0, true); 
    } else {
        generationIndicator.text("No generations to display.");
        yAxisGroup.call(d3.axisLeft(yDensityScale.domain([0,1])).ticks(5).tickFormat(() => ""));
        if (controlsContainer) controlsContainer.style("display", "none");
    }
}
