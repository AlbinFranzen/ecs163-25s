/**
 * Creates a Ridgeline Plot showing the distribution of Total Stats by Generation.
 * @param {Array<Object>} data - The processed Pokemon dataset. Each object is expected
 * to have `Generation` and `Total` properties.
 * @param {string} containerId - The CSS selector for the HTML div where the chart will be rendered.
 */
export function createRidgelinePlot(data, containerId) {
    const container = d3.select(containerId);
    // Clear previous SVG first
    // container.select("svg").remove();

    // Get container dimensions dynamically
    const BORDER_BOX_PADDING = 15; // From your .chart-container padding in style.css
    const currentWidth = container.node().clientWidth - (BORDER_BOX_PADDING * 2);
    const currentHeight = container.node().clientHeight - (BORDER_BOX_PADDING * 2);

    // Define margins
    const margin = {top: 30, right: 30, bottom: 40, left: 50}; // Adjust as needed
    const width = currentWidth - margin.left - margin.right;
    const height = currentHeight - margin.top - margin.bottom;

    // Create SVG (using viewBox is often better for responsiveness)
    const svg = container.append("svg")
        // Set width/height for the element's space, but viewBox controls internal scaling
        .attr("viewBox", `0 0 ${currentWidth} ${currentHeight}`)
        .attr("preserveAspectRatio", "xMidYMid meet") // Optional: control aspect ratio
      .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Data Processing for this chart ---
    /**
     * @const {string[]} generations - Sorted array of unique Pokémon generations (as strings)
     * present in the data, used for the Y-axis and grouping.
     */
    const generations = [...new Set(data.map(d => d.Generation))]
                         .filter(g => !isNaN(g)) // Filter out potential NaN generations
                         .sort((a, b) => a - b)
                         .map(String); // Convert to string for categorical scale, but keep numerical order

    /**
     * @const {d3.InternMap<string, Array<Object>>} dataByGen - Data grouped by Pokémon Generation.
     * Keys are generation strings, values are arrays of Pokémon objects belonging to that generation.
     * Filters out data with invalid 'Total' or 'Generation' values.
     */
     const dataByGen = d3.group(
        data.filter(d => !isNaN(d.Total) && d.Generation !== undefined && !isNaN(d.Generation)),
        d => String(d.Generation) // Group by string representation of Generation
    );


    if (dataByGen.size === 0) {
        console.warn(`No valid data found for Ridgeline plot in ${containerId} after filtering.`);
         svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor","middle").text("No data for Ridgeline Plot.");
        return;
    }

    /**
     * @const {Array<{key: string, values: Array<Object>}>} dataByGenArray - Array representation of `dataByGen`,
     * ordered by `generations`. Each element has a `key` (generation string) and `values` (array of Pokémon).
     * Filters out generations that have no valid data after initial filtering.
     */
     const dataByGenArray = generations.map(genKey => ({
        key: genKey,
        values: dataByGen.get(genKey) || [] // Handle cases where a generation might be filtered out entirely
    })).filter(d => d.values.length > 0); // Ensure we only plot gens with data


    // --- Scales ---
    /**
     * @const {[number, number]|undefined[]} totalExtent - The minimum and maximum 'Total' stat values in the dataset.
     */
    const totalExtent = d3.extent(data, d => d.Total);
    if (totalExtent[0] === undefined || totalExtent[1] === undefined || isNaN(totalExtent[0]) || isNaN(totalExtent[1])) {
         console.error(`Could not determine valid extent of 'Total' stats for ${containerId} Ridgeline xScale.`);
         svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor","middle").text("Invalid 'Total' stat data.");
         return;
    }
    /**
     * @const {d3.ScaleLinear} xScale - D3 linear scale for mapping 'Total' stat values to horizontal positions.
     */
    const xScale = d3.scaleLinear()
        .domain(totalExtent)
        .range([0, width])
        .nice();

    /**
     * @const {d3.ScaleBand} yScale - D3 band scale for mapping Pokémon generations to vertical positions (bands).
     */
    const yScale = d3.scaleBand()
        .domain(generations) // Use the sorted string list of generations
        .range([0, height])
        .paddingInner(0.2) // Adjust overlap/spacing
     if (yScale.bandwidth() <= 0) {
         console.error(`Ridgeline yScale bandwidth is zero or negative for ${containerId}. Check height/padding.`);
         svg.append("text").attr("x", width/2).attr("y", height/2).attr("text-anchor","middle").text("Chart height too small for Ridgeline.");
         return;
     }

    /**
     * @const {d3.ScaleLinear} densityHeightScale - D3 linear scale for mapping density values (from KDE)
     * to vertical height within each generation's band. The domain is set dynamically for each ridge.
     */
    const densityHeightScale = d3.scaleLinear()
       .range([yScale.bandwidth(), 0]); // Max density maps to top of band, 0 maps to bottom


    // --- Kernel Density Estimation (KDE) Function ---
    /**
     * Creates a kernel density estimator function.
     * @param {function} kernel - The kernel function (e.g., Epanechnikov).
     * @param {Array<number>} X - An array of x-values (ticks) at which to compute the density.
     * @returns {function(Array<number>): Array<[number, number]>} A function that takes an array of sample values (V)
     * and returns an array of [x, density] pairs.
     */
    function kernelDensityEstimator(kernel, X) {
      return function(V) {
        return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
      }
    }
    /**
     * Epanechnikov kernel function.
     * @param {number} k - The bandwidth of the kernel.
     * @returns {function(number): number} The kernel function.
     */
    function kernelEpanechnikov(k) {
      return function(v) {
        return Math.abs(v /= k) <= 1 ? 0.75 * (1 - v * v) / k : 0;
      };
    }
    /**
     * @const {function(Array<number>): Array<[number, number]>} kde - The Kernel Density Estimator function
     * configured with an Epanechnikov kernel, a bandwidth of 20, and evaluated at 60 points along the xScale.
     */
    const kde = kernelDensityEstimator(kernelEpanechnikov(20), xScale.ticks(60));

    // --- Axes ---
    /**
     * @const {d3.Axis} xAxis - D3 axis generator for the X-axis (Total Stats).
     */
    const xAxis = d3.axisBottom(xScale).ticks(Math.max(2, Math.floor(width / 80)));
    /**
     * @const {d3.Axis} yAxis - D3 axis generator for the Y-axis (Generations).
     */
    const yAxis = d3.axisLeft(yScale);

    svg.append("g").attr("class", "x axis").attr("transform", `translate(0, ${height})`).call(xAxis);
    svg.append("g").attr("class", "y axis").call(yAxis);

    // Axis Labels & Title
     // Axis Labels & Title
     svg.append("text") .attr("class", "axis-label") .attr("x", width / 2) .attr("y", height + margin.bottom - 10).style("text-anchor", "middle").text("Total Stats");
     svg.append("text") .attr("class", "axis-label axis-label-y") // Added 'axis-label-y'
        .attr("transform", "rotate(-90)") 
        .attr("x", -height / 2) 
        .attr("y", -margin.left + 15)
        .style("text-anchor", "middle")
        .text("Generation");
     svg.append("text") .attr("x", width / 2) .attr("y", 0 - margin.top / 2) .attr("text-anchor", "middle") .style("font-size", "14px") .style("text-decoration", "underline") .text("Distribution of Total Stats by Generation");

    // --- Drawing Ridges ---
    svg.selectAll("g.ridge")
        .data(dataByGenArray) // Use the prepared array
        .enter()
        .append("g")
            .attr("class", "ridge")
            .attr("transform", d => `translate(0, ${yScale(d.key)})`) // Position based on generation key
        /**
         * Processes each generation's data to calculate and draw its density ridge.
         * @param {Object} d - The data object for the current generation, containing `key` (generation string)
         * and `values` (array of Pokémon objects).
         * @this {SVGGElement} The current `<g class="ridge">` element.
         */
        .each(function(d) { // d is { key: "Gen", values: [...] }
            const genDataTotals = d.values.map(p => p.Total).filter(val => !isNaN(val));
            if (genDataTotals.length < 2) { // Need at least 2 points for KDE
                 console.warn(`Generation ${d.key} has less than 2 valid 'Total' data points. Skipping density.`);
                return;
            }
            const density = kde(genDataTotals); // Calculate density based on Total stats

            // Find max density for this specific generation to scale its curve height
            const maxDensity = d3.max(density, p => p[1]);
             if (isNaN(maxDensity) || maxDensity <= 0) {
                 console.warn(`Could not calculate valid max density for Generation ${d.key}.`);
                 return;
             }
            densityHeightScale.domain([0, maxDensity]); // Set domain for this curve

            /**
             * @const {d3.Area} area - D3 area generator for creating the density curve shape.
             */
            const area = d3.area()
    .curve(d3.curveBasis)
    .x(p => xScale(p[0]))
    .y0(yScale.bandwidth())
    .y1(p => {
        const yVal = densityHeightScale(p[1]); // densityHeightScale's domain is set per-ridge
        return isNaN(yVal) ? yScale.bandwidth() : yVal;
    });

            d3.select(this) // Select the current <g class="ridge">
                .append("path")
                // Filter density points with valid numbers before drawing
                .datum(density.filter(p => !isNaN(p[0]) && !isNaN(p[1])))
                .attr("class", "ridge-area")
                .attr("d", area)
                // .style("fill", "steelblue") // Style via CSS if preferred
              .append("title")
                 .text(`Generation ${d.key}`); // Simple tooltip showing generation
        });
    // ——— Interaction: click to zoom a single ridge ———
    const ridgeGroups = svg.selectAll("g.ridge");

    // ——— "Show All Plots" link in the SVG ———
    const showAllLink = svg.append("text")
        .attr("class", "show-all-link")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2 + 30)    // a bit lower under the title
        .attr("text-anchor", "middle")
        .style("font-size", "10px")
        .style("fill", "blue")
        .style("text-decoration", "underline")
        .style("cursor", "pointer")
        .text("Show All Plots")
        .style("display", "none")
        .on("click", resetAll);

    function resetAll() {
      // restore y-axis label (scoped to this svg)
      svg.select(".axis-label-y").text("Generation");
      // restore every ridge
      ridgeGroups
        .style("display", null)
        .transition().duration(600)
          .style("opacity", 1)
          .attr("transform", d => `translate(0, ${yScale(d.key)}) scale(1,1)`);
      // restore categorical y-axis (scoped to this svg)
      yScale.domain(generations);
      svg.select(".y.axis")
         .transition().duration(600)
         .call(d3.axisLeft(yScale));
      showAllLink.style("display", "none");
    }

    ridgeGroups
      .style("cursor", "pointer")
      .on("click", function(event, d_clicked) {
        // hide all other groups
        ridgeGroups.style("display", "none");

        // bring clicked ridge to front, center it, and scale it up
        const sel = d3.select(this).style("display", null).raise();
        sel.transition().duration(600)
          .style("opacity", 1)
          .attr("transform", `translate(0, ${2.3*yScale.bandwidth()}) scale(1,5)`)
          .style("stroke-width", "0px");

        // Prepare data for KDE (only valid 'Total' stats)
        const genTotals = d_clicked.values.map(p => p.Total).filter(val => !isNaN(val));
        
        let density = [];
        // KDE generally needs at least 2 points for meaningful output
        if (genTotals.length >= 2) { 
            density = kde(genTotals);
        }

        // Find the maximum density value calculated by KDE
        const calculatedMaxDensity = d3.max(density, p => p[1]); // p[1] is the density value

        // Determine the domain for the y-axis scale (based on density values)
        // If no positive density, default domain top to 1 for scaling purposes
        const maxDensityForDomain = (calculatedMaxDensity && calculatedMaxDensity > 0) ? calculatedMaxDensity : 1;
        const yDen = d3.scaleLinear().domain([0, maxDensityForDomain]).range([height, 0]);

        // Determine the multiplier for tick labels.
        // This will scale the density axis so its peak represents the number of valid data points.
        const N_valid_points = genTotals.length; // Number of Pokémon with valid 'Total' stats for this generation
        let tickDisplayMultiplier;

        if (N_valid_points === 0) {
          tickDisplayMultiplier = 0; // If no valid points, all scaled counts are 0
        } else if (calculatedMaxDensity && calculatedMaxDensity > 0) {
          // Scale so that the peak density value (calculatedMaxDensity) on the axis corresponds to N_valid_points
          tickDisplayMultiplier = N_valid_points / calculatedMaxDensity;
        } else {
          // No positive max density found (or density array was empty due to insufficient points).
          // The yDen domain top is 1. We want this '1' to represent N_valid_points.
          tickDisplayMultiplier = N_valid_points;
        }

        // Update the Y-axis label
        svg.select(".axis-label-y").text("Number of Pokémon");

        // Update the Y-axis ticks and their formatting
        svg.select(".y.axis")
           .transition().duration(600)
           .call(d3.axisLeft(yDen).ticks(4).tickFormat(t => {
               const scaledValue = t * tickDisplayMultiplier;
               // Format as integer, ensuring small floating point numbers near zero are displayed as "0"
               return d3.format(".0f")(Math.abs(scaledValue) < 1e-9 ? 0 : scaledValue);
           }));
        
        // Show the "Show All Plots" link
        showAllLink.style("display", null);
      })
      .on("dblclick", resetAll);
}
