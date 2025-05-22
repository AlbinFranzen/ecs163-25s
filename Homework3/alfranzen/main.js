/**
 * @file Main script for loading Pokémon data and rendering various D3.js charts.
 * Handles data preprocessing, initial plot rendering, and responsive resizing of charts.
 */

// Import the plotting functions from their component files
import { createStackedBarChart } from './stackedBarChart.js';
import { createRidgelinePlot } from './ridgelinePlot.js';
import { createParallelCoordinatesPlot } from './parallelCoordinatesPlot.js';

// --- Debounce function ---
/**
 * Debounces a function, delaying its execution until after a specified wait time
 * has elapsed since the last time it was invoked.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @param {boolean} [immediate=false] - If true, trigger the function on the leading edge instead of the trailing.
 * @returns {Function} The debounced function.
 */
function debounce(func, wait, immediate) {
    var timeout;
    return function() {
        var context = this, args = arguments;
        var later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        var callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func.apply(context, args);
    };
};


// --- Plotting function ---
/**
 * Renders all the charts (Stacked Bar Chart, Ridgeline Plot, Parallel Coordinates Plot)
 * into their respective containers. Clears previous SVGs before redrawing.
 * @param {Array<Object>} data - The processed Pokémon dataset.
 */
function renderPlots(data) {
    console.log("Attempting to render plots...");
    try {
        // Clear previous SVGs before redrawing
        d3.select("#topLeftChart").select("svg").remove();
        createStackedBarChart(data, "#topLeftChart");
        console.log("Stacked Bar Chart rendered.");
    } catch (error) {
        console.error("Error rendering Stacked Bar Chart:", error);
         d3.select("#topLeftChart").html(`<p style="color:red; padding:10px;">Chart Error: ${error.message}</p>`);
    }

    try {
        // Clear previous SVGs before redrawing
        d3.select("#bottomLeftChart").select("svg").remove();
        createRidgelinePlot(data, "#bottomLeftChart");
         console.log("Ridgeline Plot rendered.");
    } catch (error) {
        console.error("Error rendering Ridgeline Plot:", error);
        d3.select("#bottomLeftChart").html(`<p style="color:red; padding:10px;">Chart Error: ${error.message}</p>`);
    }

    try {
        // Clear previous SVGs before redrawing
        d3.select("#rightChart").select("svg").remove();
        createParallelCoordinatesPlot(data, "#rightChart");
         console.log("Parallel Coordinates Plot rendered.");
    } catch (error) {
        console.error("Error rendering Parallel Coordinates Plot:", error);
        d3.select("#rightChart").html(`<p style="color:red; padding:10px;">Chart Error: ${error.message}</p>`);
    }
}


// Wait for the DOM to load
document.addEventListener("DOMContentLoaded", function() {
    /**
     * Main execution block after the DOM is fully loaded.
     * Fetches, processes, and then renders Pokémon data into charts.
     * Sets up a resize listener to make charts responsive.
     */
    console.log("DOM Loaded. Fetching data...");

    // --- Data Loading and Preprocessing ---
    d3.csv("pokemon.csv").then(function(data) {
        /**
         * Callback function executed after successfully loading and parsing 'pokemon.csv'.
         * Performs data type conversions, handles missing values, and logs processing information.
         * @param {Array<Object>} data - The raw data loaded from the CSV file.
         */
        console.log("Data fetched. Processing...");

        // Data type conversion and correction based on actual CSV headers
        data.forEach((d, i) => { // Add index i for better error reporting
            // Convert numerical columns to numbers
            // Use parseFloat for potentially non-integer numbers
            d.Total = +d.Total;
            d.HP = +d.HP;
            d.Attack = +d.Attack;
            d.Defense = +d.Defense;
            d.Sp_Atk = +d.Sp_Atk;
            d.Sp_Def = +d.Sp_Def;
            d.Speed = +d.Speed;
            d.Generation = +d.Generation;
            d.Height_m = parseFloat(d.Height_m); 
            d.Weight_kg = parseFloat(d.Weight_kg); 
            d.Catch_Rate = +d.Catch_Rate;
            d.Pr_Male = parseFloat(d.Pr_Male); 

            // Convert boolean-like strings to booleans
            // Be explicit: check against 'True' case-sensitive from CSV
            d.isLegendary = d.isLegendary === 'True';
            d.hasGender = d.hasGender === 'True';
            d.hasMegaEvolution = d.hasMegaEvolution === 'True';

            // Handle missing Type 2 - Assign a consistent "None" value
            if (!d.Type_2 || String(d.Type_2).trim() === "") {
                d.Type_2 = "None";
            } else {
                d.Type_2 = String(d.Type_2).trim(); // Ensure no leading/trailing spaces
            }
             // Trim Type 1 as well
             if (d.Type_1) d.Type_1 = String(d.Type_1).trim();


            // Check for NaN values after conversion (important!)
            const numericalColumns = ['Total', 'HP', 'Attack', 'Defense', 'Sp_Atk', 'Sp_Def', 'Speed', 'Generation', 'Height_m', 'Weight_kg', 'Catch_Rate', 'Pr_Male'];
            numericalColumns.forEach(col => {
                if (isNaN(d[col])) {
                    // Log specific Pokemon and the problematic column/value
                    console.warn(`NaN found in row ${i + 2} (Pokemon: ${d.Name || d.Number || 'Unknown'}), column '${col}'. Original value: '${d[col]}' forced to NaN.`);
                    // Decide handling: Here we leave it as NaN, plots should filter/handle it.
                    // Alternatively, set a default: d[col] = 0; // (Use with caution)
                }
            });
        });

        console.log("Data processed. Sample:", data[0]);
        console.log(`Total records processed: ${data.length}`);

        // --- Initial Plot Rendering ---
        renderPlots(data);

        // --- Setup Resize Listener ---
        /**
         * Event listener for window resize events.
         * Calls the renderPlots function (debounced) to redraw charts
         * ensuring responsiveness.
         */
        window.addEventListener("resize", debounce(() => {
            console.log("Window resized, re-rendering all plots…");
            renderPlots(data);
          }, 250));


    }).catch(function(error) {
        /**
         * Callback function executed if there's an error loading or parsing 'pokemon.csv'.
         * Logs the error and displays a fatal error message to the user.
         * @param {Error} error - The error object.
         */
        console.error("Error loading or parsing data (pokemon.csv):", error);
        // Display error message in the body or a specific div
        document.body.innerHTML = `<p style="color:red; font-size: 16px; padding: 20px;"><b>Fatal Error:</b> Could not load or parse pokemon.csv. Please check the file path and format. Details: ${error.message}</p>`;
    });

}); 
