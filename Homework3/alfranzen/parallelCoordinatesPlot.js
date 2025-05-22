// Helper for d3.selection.prototype.styles
if (!d3.selection.prototype.styles) {
    /**
     * A helper function to apply multiple styles to a D3 selection.
     * This function is added to `d3.selection.prototype` if it doesn't already exist.
     * @memberof d3.selection.prototype
     * @param {Object} styles - An object where keys are CSS property names and values are the corresponding style values.
     *                        Values can also be functions that take the datum (d) and current element (this) and return a style value.
     * @param {(function(string, (string|number), d3.selection):boolean|string)} [importantCallback] - Optional.
     *                        If a function, it's called for each property with `(property, value, node)` and should return `true` if
     *                        the style should be `!important`. If the string "important",
     *                        all styles are applied with `!important`.
     * @returns {d3.selection} The D3 selection, allowing for chaining.
     */
    d3.selection.prototype.styles = function(styles, importantCallback) {
        return this.each(function(d) {
            const node = d3.select(this);
            for (const property in styles) {
                if (styles.hasOwnProperty(property)) {
                    let value = typeof styles[property] === 'function' ? styles[property].call(this, d) : styles[property];
                    let isImportant = false;
                    if (typeof importantCallback === 'function') {
                        isImportant = importantCallback(property, value, node);
                    } else if (typeof importantCallback === 'string' && importantCallback === 'important') {
                        isImportant = true;
                    }
                    node.style(property, value, isImportant ? "important" : null);
                }
            }
        });
    };
}

/**
 * Creates a Parallel Coordinates Plot showing relationships between numeric stats.
 * @param {Array<Object>} data - The processed Pokemon dataset. Each object should contain
 *                               at least the `Name`, `Type_1`, and the numeric stat
 *                               properties: `HP`, `Attack`, `Defense`, `Sp_Atk`, `Sp_Def`, `Speed`.
 *                               `Type_2` is optional.
 * @param {string} containerId - The CSS selector for the HTML div where the chart will be rendered.
 *                               Example: "#pcp-container".
 */
export function createParallelCoordinatesPlot(data, containerId) {
    const mainContainer = d3.select(containerId);
    mainContainer.html("");

    mainContainer
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("justify-content", "flex-start")
        .style("align-items", "stretch");

    const titleWrapper = mainContainer.append("div")
        .attr("class", "pcp-title-wrapper")
        .style("padding", "10px 5px 5px 5px")
        .style("text-align", "center")
        .style("flex-shrink", "0");

    titleWrapper.append("h3")
        .style("margin", "0")
        .style("font-size", "16px")
        .style("text-decoration", "underline")
        .text("Pokémon Stat Comparison");

    const controlsWrapper = mainContainer.append("div")
        .attr("class", "pcp-controls-wrapper")
        .style("padding", "5px")
        .style("flex-shrink", "0");

    const chartWrapper = mainContainer.append("div")
        .attr("class", "pcp-chart-wrapper")
        .style("width", "100%")
        .style("flex-grow", "1")
        .style("min-height", "0")
        .style("overflow", "hidden");

    // --- Overlay for Modal ---
    const overlay = mainContainer.append("div")
        .attr("class", "pcp-modal-overlay")
        .style("position", "fixed")
        .style("top", "0")
        .style("left", "0")
        .style("width", "100%")
        .style("height", "100%")
        .style("background-color", "rgba(0,0,0,0.5)")
        .style("z-index", "999") // Below modal, above everything else
        .style("display", "none"); // Initially hidden

    // --- Pokémon Info Display Wrapper (Modal) ---
    const pokemonInfoWrapper = mainContainer.append("div")
        .attr("class", "pcp-pokemon-info-wrapper")
        .style("position", "fixed")
        .style("top", "50%")
        .style("left", "50%")
        .style("transform", "translate(-50%, -50%)")
        .style("background-color", "#ffffff")
        .style("padding", "25px") // Increased padding
        .style("border", "1px solid #ccc")
        .style("border-radius", "8px")
        .style("box-shadow", "0 5px 15px rgba(0,0,0,0.3)")
        .style("z-index", "1000") // On top of overlay
        .style("min-width", "350px")
        .style("max-width", "calc(100vw - 40px)") // Ensure some viewport margin
        .style("max-height", "calc(100vh - 40px)")
        .style("overflow-y", "auto")
        .style("display", "none"); // Initially hidden

    const dimensions = ['HP', 'Attack', 'Defense', 'Sp_Atk', 'Sp_Def', 'Speed'];
    const allValidPokemonData = data.filter(d => dimensions.every(dim => d[dim] !== undefined && !isNaN(d[dim])));

    if (allValidPokemonData.length === 0) {
        console.warn(`No valid data found for Parallel Coordinates plot in ${containerId}.`);
        chartWrapper.html("");
        chartWrapper.append("p").style("padding", "10px").text("No valid data for Parallel Coordinates.");
        return;
    }

    const primaryTypesForSelector = [...new Set(allValidPokemonData.map(d => d.Type_1))].sort();
    const palette = d3.schemeCategory10.concat(d3.schemeSet3);
    const colorScale = d3.scaleOrdinal()
        .domain(primaryTypesForSelector)
        .range(palette.slice(1, primaryTypesForSelector.length + 1)); // Start from the 2nd color

    /**
     * Determines an appropriate text color (black or white) based on the luminance of a background color.
     * @private
     * @param {string} hexColor - The background color in hexadecimal format (e.g., "#FF0000").
     * @returns {string} "#000000" (black) or "#FFFFFF" (white) for good contrast.
     */
    function getTextColorForBackground(hexColor) {
        const rgb = d3.rgb(hexColor);
        const luminance = 0.2126 * rgb.r / 255 + 0.7152 * rgb.g / 255 + 0.0722 * rgb.b / 255;
        return luminance > 0.5 ? "#000000" : "#FFFFFF";
    }

    controlsWrapper.style("display", "flex").style("flex-wrap", "wrap").style("gap", "5px");

    const buttonBaseStyle = {
        "padding": "6px 10px", "font-size": "0.9em", "border-radius": "4px",
        "border": "1px solid #ccc", "background-color": "#f0f0f0", "color": "#333",
        "cursor": "pointer", "margin-bottom": "5px",
        "transition": "background-color 0.2s ease-in-out, border-color 0.2s ease-in-out"
    };
    const buttonHoverStyle = { "background-color": "#e0e0e0", "border-color": "#bbb" };

    controlsWrapper.append("button").text("Select All")
        .each(function() { d3.select(this).styles(buttonBaseStyle); })
        .on("mouseover", function() { d3.select(this).styles(buttonHoverStyle); })
        .on("mouseout", function() { d3.select(this).styles(buttonBaseStyle); })
        .on("click", () => {
            controlsWrapper.selectAll("label").style("opacity", 1.0);
            controlsWrapper.selectAll("input[type=checkbox]").property("checked", true);
            updatePlot();
        });

    controlsWrapper.append("button").text("Deselect All").style("margin-left", "5px")
        .each(function() { d3.select(this).styles(buttonBaseStyle); })
        .on("mouseover", function() { d3.select(this).styles(buttonHoverStyle); })
        .on("mouseout", function() { d3.select(this).styles(buttonBaseStyle); })
        .on("click", () => {
            controlsWrapper.selectAll("label").style("opacity", 0.5);
            controlsWrapper.selectAll("input[type=checkbox]").property("checked", false);
            updatePlot();
        });

    primaryTypesForSelector.forEach(type => {
        const typeColor = colorScale(type);
        const textColor = getTextColorForBackground(typeColor);
        const label = controlsWrapper.append("label")
            .style("font-size", "0.85em").style("display", "inline-flex")
            .style("align-items", "center").style("padding", "3px 6px")
            .style("background-color", typeColor).style("color", textColor)
            .style("border-radius", "4px").style("cursor", "pointer")
            .style("opacity", 1.0).style("transition", "opacity 0.2s ease-in-out");
        label.append("input").attr("type", "checkbox").attr("value", type)
            .property("checked", true).style("margin-right", "4px").style("cursor", "pointer")
            .on("change", function() {
                d3.select(this.parentNode).style("opacity", d3.select(this).property("checked") ? 1.0 : 0.5);
                updatePlot();
            });
        label.append("span").text(type);
    });

    let selectedPokemon = null;
    let linesGroupSelection;

    /**
     * Updates the visual styles of the Pokémon paths in the PCP.
     * Highlights the selected Pokémon, and fades or shows others based on the selection state.
     * Relies on `selectedPokemon` and `linesGroupSelection` being in scope.
     * @private
     */
    function updateLineStyles() {
        if (!linesGroupSelection) return;
        linesGroupSelection.selectAll(".pokemon-path")
            .style("stroke-width", d => (selectedPokemon && d.Name === selectedPokemon.Name) ? 3.5 : 2)
            .style("opacity", d => (!selectedPokemon || d.Name === selectedPokemon.Name) ? (selectedPokemon ? 1 : 0.5) : 0.05);
        if (selectedPokemon) {
            const selectedPath = linesGroupSelection.selectAll(".pokemon-path").filter(d => d.Name === selectedPokemon.Name);
            if (!selectedPath.empty()) selectedPath.raise();
        }
    }

    /**
     * Draws or redraws the Parallel Coordinates Plot SVG chart with the given data.
     * This function handles the creation of axes, lines (paths for Pokémon), and interaction handlers.
     * @private
     * @param {Array<Object>} plotData - The filtered Pokemon data to be plotted. Each object represents a Pokémon.
     */
    function drawPcpChart(plotData) {
        chartWrapper.select("svg.pcp-chart-svg").remove();
        chartWrapper.select("p.pcp-message").remove();
        const chartNode = chartWrapper.node();
        const svgViewBoxWidth = chartNode.clientWidth;
        const svgViewBoxHeight = chartNode.clientHeight;
        const margin = { top: 0, right: 20, bottom: 100, left: 20 }; // Increased bottom margin for axis labels if needed
        const width = svgViewBoxWidth - margin.left - margin.right;
        const height = svgViewBoxHeight - margin.top - margin.bottom;

        if (width <= 0 || height <= 50) { // Ensure minimum drawable area
            chartWrapper.append("p").attr("class", "pcp-message").style("padding", "10px").text("Not enough space for chart.");
            return;
        }
        const svg = chartWrapper.append("svg").attr("class", "pcp-chart-svg")
            .attr("viewBox", `0 0 ${svgViewBoxWidth} ${svgViewBoxHeight}`).attr("preserveAspectRatio", "xMidYMid meet")
            .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        if (plotData.length === 0) {
            svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").text("No Pokémon of selected types.");
            return;
        }
        const xScale = d3.scalePoint().domain(dimensions).range([0, width]).padding(0.2);
        let globalMin = Infinity, globalMax = -Infinity;
        plotData.forEach(d => dimensions.forEach(dim => {
            const val = d[dim];
            if (val !== undefined && !isNaN(val)) {
                if (val < globalMin) globalMin = val;
                if (val > globalMax) globalMax = val;
            }
        }));
        if (globalMin === Infinity || globalMax === -Infinity) { // Should not happen if allValidPokemonData is filtered
            svg.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor", "middle").text("Error: Invalid data range.");
            return;
        }
        const yScale = d3.scaleLinear().domain([globalMin, globalMax]).range([height, 0]).nice();
        svg.selectAll(".dimension").data(dimensions).enter().append("g")
            .attr("class", "dimension axis").attr("transform", d => `translate(${xScale(d)}, 0)`)
            .each(function(dimName) { d3.select(this).call(d3.axisLeft(yScale).ticks(5)); })
            .append("text").attr("class", "axis-label").style("text-anchor", "middle")
            .attr("y", -15).attr("x", 0).text(d => d.replace('_', '. ')); // Adjusted y for label position

        /**
         * Generates the SVG path string for a single Pokémon's data line across the dimensions.
         * @private
         * @param {Object} d_path - The data object for a single Pokémon. Must contain properties for each dimension.
         * @returns {string|null} The SVG path string (e.g., "M0,100L50,200..."), or null if not enough valid points.
         */
        function pathGen(d_path) {
            const points = dimensions.map(p => [xScale(p), yScale(d_path[p])]).filter(pt => !isNaN(pt[0]) && !isNaN(pt[1]));
            return points.length >= 2 ? d3.line()(points) : null;
        }
        linesGroupSelection = svg.append("g").attr("class", "pcp-lines");
        const paths = linesGroupSelection.selectAll(".pokemon-path").data(plotData, d => d.Name) // Key by Name
            .enter().append("path").attr("class", "pcp-path pokemon-path").attr("d", pathGen)
            .style("stroke", d => colorScale(d.Type_1)).style("fill", "none")
            .style("display", d => pathGen(d) ? null : "none"); // Hide paths that can't be drawn
        paths.append("title").text(d => `${d.Name} (${d.Type_1}${d.Type_2 && d.Type_2 !== 'None' ? '/' + d.Type_2 : ''})\n` +
            dimensions.map(dim => `${dim.replace('_', '. ')}: ${d[dim]}`).join('\n'));

        paths.on("mouseover", function(event, d_hover) {
            if (selectedPokemon && d_hover.Name === selectedPokemon.Name) return; // Don't change if it's already selected
            d3.select(this).raise().style("stroke-width", 4).style("opacity", 1);
            linesGroupSelection.selectAll(".pokemon-path")
                .filter(p => p !== d_hover && (!selectedPokemon || p.Name !== selectedPokemon.Name))
                .style("opacity", 0.02);
        }).on("mouseout", () => updateLineStyles()) // Revert to base styles or selected style
        .on("click", async function(event, d_clicked) {
            event.stopPropagation(); // Prevent click from bubbling to overlay if modal is open
            selectedPokemon = d_clicked;
            pokemonInfoWrapper.html(""); // Clear previous content

            const infoContent = pokemonInfoWrapper.append("div").style("display", "flex").style("align-items", "flex-start");
            const imgElement = infoContent.append("img")
                .attr("src", "https://via.placeholder.com/96?text=Loading...") // Placeholder image
                .style("width", "96px").style("height", "96px").style("margin-right", "20px")
                .style("object-fit", "contain").style("border", "1px solid #eee").style("flex-shrink", "0");
            const statsDiv = infoContent.append("div").style("flex-grow", "1");
            statsDiv.append("h4").text(d_clicked.Name).style("margin", "0 0 8px 0").style("font-size", "1.2em");
            statsDiv.append("p").text(`Type: ${d_clicked.Type_1}${d_clicked.Type_2 && d_clicked.Type_2 !== 'None' ? ' / ' + d_clicked.Type_2 : ''}`)
                .style("margin", "0 0 10px 0").style("font-size", "0.95em");
            const statsList = statsDiv.append("ul").style("list-style-type", "none").style("padding-left", "0").style("font-size", "0.9em").style("margin", "0");
            dimensions.forEach(dim => statsList.append("li").style("margin-bottom", "3px").text(`${dim.replace('_', '. ')}: ${d_clicked[dim]}`));
            
            const closeButton = pokemonInfoWrapper.append("button").text("Close")
                .styles(buttonBaseStyle) // Apply base styles
                .style("display", "block").style("margin", "20px auto 0 auto") // Centered margin top
                .on("mouseover", function() { d3.select(this).styles(buttonHoverStyle); })
                .on("mouseout", function() { d3.select(this).styles(buttonBaseStyle); });
            
            closeButton.on("click", (e) => { // Assign click after creation and styling
                    e.stopPropagation();
                    selectedPokemon = null;
                    pokemonInfoWrapper.style("display", "none").html("");
                    overlay.style("display", "none"); // Hide overlay
                    updateLineStyles();
                });

            pokemonInfoWrapper.style("display", "block");
            overlay.style("display", "block"); // Show overlay

            let apiName = d_clicked.Name.toLowerCase();
            try {
                // Name sanitization for PokeAPI
                apiName = d_clicked.Name.toLowerCase().replace(/\s+/g, '-').replace(/['.]/g, '').replace(/♀/g, '-f').replace(/♂/g, '-m');
                // Specific known API name overrides
                if (apiName === "mr-mime") apiName = "mr-mime"; else if (apiName === "mime-jr") apiName = "mime-jr";
                else if (apiName === "farfetchd") apiName = "farfetchd"; else if (apiName === "sirfetchd") apiName = "sirfetchd";
                else if (apiName === "type-null") apiName = "type-null"; else if (apiName.startsWith("tapu-")) apiName = apiName;
                // Other common cases might need to be added here if issues are found.
                
                const response = await d3.json(`https://pokeapi.co/api/v2/pokemon/${apiName}`);
                const imageUrl = response.sprites.other['official-artwork']?.front_default || response.sprites?.front_default || "https://via.placeholder.com/96?text=N/A";
                imgElement.attr("src", imageUrl);
            } catch (error) {
                console.error(`Failed to fetch Pokémon image for '${d_clicked.Name}' (tried '${apiName}') from PokeAPI:`, error);
                imgElement.attr("src", "https://via.placeholder.com/96?text=Error"); // Show error image
            }
            updateLineStyles(); // Update line styles to reflect new selection
        });
        updateLineStyles(); // Initial application of line styles
    }

    /**
     * Filters the main dataset based on the currently selected Pokémon types
     * from the checkboxes and then calls `drawPcpChart` to re-render the plot.
     * Also handles resetting `selectedPokemon` and hiding the modal if its type is deselected.
     * @private
     */
    function updatePlot() {
        const selectedTypesArray = [];
        controlsWrapper.selectAll("input[type=checkbox]:checked").each(function() { selectedTypesArray.push(d3.select(this).property("value")); });
        const dataToPlot = allValidPokemonData.filter(d => selectedTypesArray.includes(d.Type_1));
        if (selectedPokemon && !dataToPlot.find(p => p.Name === selectedPokemon.Name)) {
            selectedPokemon = null;
            pokemonInfoWrapper.style("display", "none").html("");
            overlay.style("display", "none"); // Hide overlay here too
        }
        drawPcpChart(dataToPlot);
    }
    updatePlot(); // Initial plot rendering
}
