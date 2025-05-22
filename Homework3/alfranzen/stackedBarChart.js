/**
 * Creates a Stacked Bar Chart showing Pokémon distribution by Primary & Secondary Type,
 * with animations and drill-down to individual Pokémon.
 * @param {Array<Object>} data - The processed Pokemon dataset. Each object is expected
 * to have `Type_1`, `Type_2`, and `Name` (for drill-down) properties.
 * @param {string} containerId - The CSS selector for the HTML div where the chart will be rendered.
 * @param {string|null} [activeFilterPrimaryType=null] - Optional. Filters chart to this primary type.
 *                                                       If provided, the chart shows secondary type distribution
 *                                                       for only this primary type.
 * @param {string|null} [activeFilterSecondaryType=null] - Optional. If set along with `activeFilterPrimaryType`,
 *                                                         the chart displays a list of Pokémon names
 *                                                         matching both the primary and secondary types.
 *                                                         This parameter is ignored if `activeFilterPrimaryType` is null.
 */
export function createStackedBarChart(data, containerId, activeFilterPrimaryType = null, activeFilterSecondaryType = null) {
    const container = d3.select(containerId);
    if (container.empty()) {
        console.error(`Container element "${containerId}" not found.`);
        return;
    }
    container.html(""); // Clear previous content

    // Define padding for the container to ensure content isn't clipped by borders/padding
    const BORDER_BOX_PADDING = 5;
    const containerWidth  = container.node().clientWidth  - BORDER_BOX_PADDING * 2;
    const containerHeight = container.node().clientHeight - BORDER_BOX_PADDING * 2;

    // If container has no effective drawing area, display a message and exit.
    if (containerWidth <= 0 || containerHeight <= 0) {
         container.html(`<p style="color:orange; padding:10px;">Container has no size. Cannot draw chart.</p>`);
         return;
    }

    // Define margins for the chart within the SVG
    const margin = {top: 50, right: 160, bottom: 30, left: 70}; // Increased right margin for legend
    // Calculate actual drawing dimensions for the chart
    let chartDrawingWidth = containerWidth - margin.left - margin.right;
    let chartDrawingHeight = containerHeight - margin.top - margin.bottom;

    // Ensure width and height are at least 1 to prevent SVG errors
    const width = Math.max(1, chartDrawingWidth);
    const height = Math.max(1, chartDrawingHeight);
    const animationDuration = 750; // Duration for D3 transitions

    // Append the main SVG element to the container
    const chartRoot = container.append("svg")
        .attr("viewBox", `0 0 ${containerWidth} ${containerHeight}`) // Responsive SVG
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g") // Group element for chart content, translated by margin
            .attr("transform", `translate(${margin.left},${margin.top})`);

    // --- Consistent Data Processing (always on full dataset) ---
    // Get all unique secondary types, sorting "None" to appear first if present.
    const allSecondaryTypes = [...new Set(data.map(d => d.Type_2))]
                           .sort((a, b) => a === "None" ? -1 : b === "None" ? 1 : a.localeCompare(b));

    // Rollup data to count Pokémon by primary type, then by secondary type.
    // `countsByTypeFull` will be a Map where keys are primary types and values are objects
    // containing counts for each secondary type and a 'total' count for that primary type.
    const countsByTypeFull = d3.rollup(data,
        leaves => {
            const counts = Object.fromEntries(allSecondaryTypes.map(secType => [secType, 0]));
            leaves.forEach(leaf => {
                 if(counts[leaf.Type_2] !== undefined) counts[leaf.Type_2]++;
                 else console.warn(`Unexpected secondary type: ${leaf.Type_2}`); // Handle potential new/unexpected types
            });
            counts.total = leaves.length; // Total Pokémon for this primary type
            return counts;
        },
        d => d.Type_1 // Group by primary type
    );

    // Convert the rollup map to an array, sort by total count (descending),
    // and structure for D3 stack layout.
    const baseSortedCountsArray = Array.from(countsByTypeFull.entries())
        .sort(([,a], [,b]) => b.total - a.total) // Sort primary types by total Pokémon
        .map(([primaryType, counts]) => ({ primaryType, ...counts })); // Flatten structure

    let effectiveFilterPrimaryType = activeFilterPrimaryType; // To track the active primary filter

    // --- Chart Title ---
    let chartTitleText = "Pokémon Distribution by Primary & Secondary Type";
    if (activeFilterPrimaryType && !activeFilterSecondaryType) {
        chartTitleText = `${activeFilterPrimaryType} Pokémon: Distribution by Secondary Type`;
    } else if (activeFilterPrimaryType && activeFilterSecondaryType) {
        chartTitleText = `${activeFilterPrimaryType} / ${activeFilterSecondaryType} Pokémon`;
    }
    chartRoot.append("text")
        .attr("class", "chart-title")
        .attr("x", width / 2)
        .attr("y", 0 - margin.top / 2 - 10) // Position above the chart
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("text-decoration", "underline")
        .text(chartTitleText);

    // --- Navigation Links ---
    // If a primary type filter is active, show a "Show All Types" link to navigate back to the overview.
    if (activeFilterPrimaryType) {
        const showAllLink = chartRoot.append("text")
            .attr("class", "nav-link show-all-link")
            .attr("y", 0 - margin.top / 2 + 5) // Position below the title
            .style("font-size", "10px")
            .style("fill", "blue")
            .style("text-decoration", "underline")
            .style("cursor", "pointer")
            .text("Show All Types")
            .on("click", () => createStackedBarChart(data, containerId, null, null)); // Re-render with no filters

        if (!activeFilterSecondaryType) { // Primary-filtered view (not Pokémon list), center the link
            showAllLink
                .attr("x", width / 2)
                .attr("text-anchor", "middle");
        } else { // Pokémon list view, align link to the right
            showAllLink
                .attr("x", width)
                .attr("text-anchor", "end");
        }
    }

    // --- View Rendering Logic ---
    // Determine which view to render based on active filters.
    if (activeFilterPrimaryType && activeFilterSecondaryType) {
        // === Pokémon Detail View (List of Pokémon names) ===
        // Filter data for Pokémon matching both primary and secondary types.
        const specificPokemon = data.filter(p => p.Type_1 === activeFilterPrimaryType && p.Type_2 === activeFilterSecondaryType);

        // Add a "Back to [Primary Type]" link to navigate to the primary type's stacked bar view.
        chartRoot.append("text")
            .attr("class", "nav-link back-to-primary-link")
            .attr("x", 0) // Align to the left
            .attr("y", 0 - margin.top / 2 + 5)
            .attr("text-anchor", "start")
            .style("font-size", "10px")
            .style("fill", "blue")
            .style("text-decoration", "underline")
            .style("cursor", "pointer")
            .text(`‹ Back to ${activeFilterPrimaryType} View`)
            .on("click", () => createStackedBarChart(data, containerId, activeFilterPrimaryType, null)); // Re-render for primary type

        // If no Pokémon match the criteria, display a message.
        if (specificPokemon.length === 0) {
            chartRoot.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor","middle")
                .text(`No Pokémon found for ${activeFilterPrimaryType} / ${activeFilterSecondaryType}.`);
            return;
        }

        const listTopMargin = 20; // Space below title/links for the list
        const foreignObjectHeight = Math.max(10, height - listTopMargin); // Ensure positive height for foreignObject

        // Use foreignObject to embed HTML for a scrollable list within SVG.
        const foreignObject = chartRoot.append("foreignObject")
            .attr("x", 0)
            .attr("y", listTopMargin)
            .attr("width", width)
            .attr("height", foreignObjectHeight);

        // Create a scrollable div within the foreignObject.
        const scrollableDiv = foreignObject.append("xhtml:div")
            .attr("class", "pokemon-list-scrollable")
            .style("height", "100%")
            .style("overflow-y", "scroll") // Enable vertical scrolling
            .style("font-size", "14px")
            .style("display", "grid") // Use CSS Grid for two columns
            .style("grid-template-columns", "repeat(2, 1fr)") // Two equal columns
            .style("gap", "2px 10px") // Row and column gap
            .style("padding", "0 5px"); // Horizontal padding

        // Bind Pokémon data to div elements, sort by name, and display them.
        scrollableDiv.selectAll("div.pokemon-name-item")
            .data(specificPokemon.sort((a,b) => d3.ascending(a.Name, b.Name))) // Sort Pokémon by name
            .enter()
            .append("xhtml:div")
            .attr("class", "pokemon-name-item")
            .style("text-align", "center") // Center text within each grid cell
            .style("padding-bottom", "2px")
            .text(d => d.Name || "Unknown Name") // Display Pokémon name
            .style("opacity", 0) // Initial state for transition
            .transition().duration(animationDuration) // Fade-in animation
            .style("opacity", 1);

    } else {
        // === Stacked Bar Chart View (Overview or Primary-Filtered) ===
        let currentSortedCountsArray;
        // Filter data if a primary type is selected, otherwise use the full dataset.
        if (activeFilterPrimaryType) {
            const filteredData = baseSortedCountsArray.find(d => d.primaryType === activeFilterPrimaryType);
            if (filteredData) {
                currentSortedCountsArray = [filteredData]; // Show only the selected primary type
            } else {
                // Fallback if the activeFilterPrimaryType is invalid (e.g., from URL manipulation)
                console.warn(`Primary type "${activeFilterPrimaryType}" not found. Displaying full chart.`);
                currentSortedCountsArray = baseSortedCountsArray;
                effectiveFilterPrimaryType = null; // Reset filter if invalid
            }
        } else {
            currentSortedCountsArray = baseSortedCountsArray; // Show all primary types
        }

        const displayedPrimaryTypes = currentSortedCountsArray.map(d => d.primaryType);

        // D3 stack generator configuration.
        const stack = d3.stack()
            .keys(allSecondaryTypes) // Keys are secondary types, determining the layers
            .order(d3.stackOrderNone) // Order of layers (no specific order here)
            .offset(d3.stackOffsetNone); // Baseline for stacking (zero)

        const series = stack(currentSortedCountsArray); // Generate stacked series data

        // Handle cases where no data is available for the chart.
        if (series.length === 0 || currentSortedCountsArray.length === 0 || displayedPrimaryTypes.length === 0) {
            let message = "No data for Stacked Bar Chart.";
            if (effectiveFilterPrimaryType) message = `No data for Primary Type: ${effectiveFilterPrimaryType}.`;
            chartRoot.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor","middle").text(message);
            return;
        }

        const maxTotal = d3.max(currentSortedCountsArray, d => d.total); // Max total Pokémon count for scaling
        // Handle cases where maxTotal is invalid, preventing scale errors.
        if (maxTotal === undefined || maxTotal <= 0) {
            chartRoot.append("text").attr("x", width / 2).attr("y", height / 2).attr("text-anchor","middle")
                .text(`No valid data counts for chart scale${effectiveFilterPrimaryType ? ` for ${effectiveFilterPrimaryType}` : ''}.`);
            return;
        }

        // --- Scales ---
        const xScale = d3.scaleLinear().domain([0, maxTotal]).range([0, width]).nice(); // X-axis scale (count)
        const yScale = d3.scaleBand().domain(displayedPrimaryTypes).range([0, height]).paddingInner(0.1).paddingOuter(0.1); // Y-axis scale (primary types)
        const colorScale = d3.scaleOrdinal().domain(allSecondaryTypes).range(d3.schemeCategory10.concat(d3.schemeSet3).slice(0, allSecondaryTypes.length)); // Color scale for secondary types

        // --- Axes ---
        const xAxis = d3.axisBottom(xScale).ticks(Math.max(2, Math.floor(width / 80))); // Dynamic number of ticks
        const yAxis = d3.axisLeft(yScale);

        // Append/update X-axis
        chartRoot.selectAll("g.x.axis").data([null])
            .join(
                enter => enter.append("g").attr("class", "x axis").attr("transform", `translate(0, ${height})`).call(xAxis),
                update => update.transition().duration(animationDuration).attr("transform", `translate(0, ${height})`).call(xAxis),
                exit => exit.remove()
            );
        // Append/update Y-axis
        chartRoot.selectAll("g.y.axis").data([null])
            .join(
                enter => enter.append("g").attr("class", "y axis").call(yAxis),
                update => update.transition().duration(animationDuration).call(yAxis),
                exit => exit.remove()
            );
        
        // Axis Labels
        chartRoot.selectAll("text.axis-label-x").data([null]).join("text").attr("class", "axis-label axis-label-x")
            .attr("x", width / 2).attr("y", height + margin.bottom - 5).style("text-anchor", "middle").text("Number of Pokémon");
        chartRoot.selectAll("text.axis-label-y").data([null]).join("text").attr("class", "axis-label axis-label-y")
            .attr("transform", "rotate(-90)").attr("x", -height / 2).attr("y", -margin.left + 15).style("text-anchor", "middle").text("Primary Type");

        // --- Layers (Segments for each Secondary Type) ---
        const layers = chartRoot.selectAll("g.layer")
            .data(series, d => d.key); // Key layers by secondary type name for object constancy

        // Remove old layers
        layers.exit()
            .transition().duration(animationDuration)
            .style("opacity", 0)
            .remove();

        // Add new layers
        const layersEnter = layers.enter().append("g")
            .attr("class", "layer")
            .attr("fill", d => colorScale(d.key)); // Set fill color for the layer (secondary type)

        const rectGroups = layers.merge(layersEnter); // Merge enter and update selections for layers

        // --- Rects (Individual bars within each layer) ---
        rectGroups.each(function(layerData) { // `layerData` is one element of `series`
            // `this` refers to the <g class="layer"> element
            // `d_layer` is one element of `layerData`, representing a segment for a primary type
            // `d_segment` is one element of `d_layer.filter(...)`, representing a single rect's data
            const rects = d3.select(this).selectAll("rect.stacked-bar-rect")
                .data(d_layer => d_layer.filter(segment => !isNaN(segment[0]) && !isNaN(segment[1]) && (segment[1] - segment[0] >= 0)), // Filter for valid, non-zero-width segments
                      d_segment => d_segment.data.primaryType); // Key rects by primary type for object constancy

            // Remove old rects
            rects.exit()
                .transition().duration(animationDuration)
                .attr("x", d_segment => xScale(d_segment[0])) // Animate width to 0
                .attr("width", 0)
                .remove();

            // Add new rects
            const rectsEnter = rects.enter().append("rect")
                .attr("class", "stacked-bar-rect")
                .attr("y", d_segment => yScale(d_segment.data.primaryType)) // Y position based on primary type
                .attr("x", d_segment => xScale(d_segment[0])) // Initial X position for animation
                .attr("width", 0) // Initial width 0 for animation
                .attr("height", yScale.bandwidth()) // Height based on band scale
                .style("cursor", "pointer")
                .on("click", function(event, d_segment_clicked) {
                    const clickedPrimaryType = d_segment_clicked.data.primaryType;
                    const secondaryTypeKey = layerData.key; // Secondary type of the clicked segment

                    // Drill-down logic:
                    if (!effectiveFilterPrimaryType) { // If on overview, drill to primary type
                        createStackedBarChart(data, containerId, clickedPrimaryType, null);
                    } else if (effectiveFilterPrimaryType === clickedPrimaryType && !activeFilterSecondaryType) { // If on primary view, drill to specific Pokémon list
                        createStackedBarChart(data, containerId, clickedPrimaryType, secondaryTypeKey);
                    }
                    // No action if already in the Pokémon list view (activeFilterSecondaryType is set)
                });
            
            // Add tooltips to new rects
            rectsEnter.append("title") 
                .text(function(d_segment_title) {
                    const primaryType = d_segment_title.data.primaryType;
                    const count = d_segment_title.data[layerData.key]; // Count for this specific segment
                    const countText = (count !== undefined && !isNaN(count)) ? count : 'N/A';
                    return `${primaryType} / ${layerData.key}: ${countText}`;
                });

            // Update existing and new rects
            rects.merge(rectsEnter) 
                .transition().duration(animationDuration)
                .attr("y", d_segment => yScale(d_segment.data.primaryType))
                .attr("x", d_segment => xScale(d_segment[0])) // Final X position
                .attr("width", d_segment => { // Final width
                    const w = xScale(d_segment[1]) - xScale(d_segment[0]);
                    return isNaN(w) || w < 0 ? 0 : Math.max(0, w); // Ensure non-negative width
                })
                .attr("height", yScale.bandwidth());
        });

        // --- Legend ---
        const legend = chartRoot.selectAll("g.legend").data([null]).join("g") // Single legend group
            .attr("class", "legend")
            .attr("transform", `translate(${width + 20}, 0)`); // Position legend to the right of the chart

        // Hide legend if chart area is too small or no data to display
        if (chartDrawingWidth < 50 || displayedPrimaryTypes.length === 0) { 
            legend.style("display", "none");
        } else {
            legend.style("display", null);
            const legendItemHeight = 15; // Height of each legend item
            const legendItemWidth = 70; // Approx width for each legend item (text + rect)
            // Calculate number of columns for legend based on available right margin
            const numColumns = Math.max(1, Math.floor((margin.right - 20) / legendItemWidth)); 
            const itemsPerColumn = Math.ceil(allSecondaryTypes.length / numColumns);

            const legendItems = legend.selectAll("g.legend-item")
                .data(allSecondaryTypes, d => d); // Key legend items by secondary type name

            legendItems.exit().remove(); // Remove old legend items

            // Add new legend items
            const legendItemsEnter = legendItems.enter().append("g")
                .attr("class", "legend-item");

            legendItemsEnter.append("rect") // Color swatch
                .attr("width", 10)
                .attr("height", 10);

            legendItemsEnter.append("text") // Type name
                .attr("x", 15) // Position text next to swatch
                .attr("y", 9) // Align text with swatch
                .style("font-size", "10px");
            
            // Update existing and new legend items
            legendItems.merge(legendItemsEnter)
                .attr("transform", (type, i) => { // Position items in columns
                    const columnIndex = Math.floor(i / itemsPerColumn);
                    const rowIndex = i % itemsPerColumn;
                    return `translate(${columnIndex * legendItemWidth}, ${rowIndex * legendItemHeight})`;
                })
                .select("rect")
                    .attr("fill", colorScale); // Set color of swatch
            
            legendItems.merge(legendItemsEnter)
                .select("text")
                    .text(type => type); // Set text of legend item
        }
    }
}
