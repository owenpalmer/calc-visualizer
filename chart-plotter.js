// Chart plotting and interaction functionality

// Shared zoom state for synchronization between charts
let sharedXTransform = d3.zoomIdentity; // Shared x-axis transform (zoom + pan)
let sharedZoomScale = 1; // Shared zoom scale factor for both axes
let chart1YPan = 0; // Independent y-axis pan for chart1
let chart2YPan = 0; // Independent y-axis pan for chart2
let isUpdatingTransform = false; // Prevent infinite loops
let isDragging = false; // Track dragging state

function calculateCenteredDomains(data, derivArr) {
    // Calculate symmetric domains around (0,0)
    const maxAbsX = Math.max(
        Math.abs(d3.min(data, d => d.x)), 
        Math.abs(d3.max(data, d => d.x))
    );
    const maxAbsY = Math.max(
        Math.abs(d3.min(data, d => d.y)), 
        Math.abs(d3.max(data, d => d.y))
    );
    const maxAbsDy = Math.max(
        Math.abs(d3.min(derivArr, d => d.dy)), 
        Math.abs(d3.max(derivArr, d => d.dy))
    );
    
    // Add padding and ensure minimum domain size
    const xPadding = Math.max(maxAbsX * 0.1, 1);
    const yPadding = Math.max(maxAbsY * 0.1, 1);
    const dyPadding = Math.max(maxAbsDy * 0.1, 1);
    
    return {
        xDomain: [-(maxAbsX + xPadding), maxAbsX + xPadding],
        yDomain: [-(maxAbsY + yPadding), maxAbsY + yPadding],
        dyDomain: [-(maxAbsDy + dyPadding), maxAbsDy + dyPadding]
    };
}

function createZoomBehavior(chartGroup, isChart1, xScale, yScale, width, height, hoverElements) {
    const zoom = d3.zoom()
        .scaleExtent([0.1, 10])
        .on('start', function(event) {
            isDragging = true;
            // Hide hover elements when dragging starts
            hoverElements.forEach(element => element.style('display', 'none'));
        })
        .on('zoom', function(event) {
            if (isUpdatingTransform) return;
            
            const transform = event.transform;
            
            // Update shared zoom scale and x-pan
            sharedZoomScale = transform.k;
            sharedXTransform = d3.zoomIdentity.translate(transform.x, 0).scale(transform.k);
            
            // Update individual y-pan for this chart
            if (isChart1) {
                chart1YPan = transform.y;
            } else {
                chart2YPan = transform.y;
            }
            
            updateAllChartTransforms();
        })
        .on('end', function(event) {
            isDragging = false;
        });
    
    return zoom;
}

function updateAllChartTransforms() {
    if (isUpdatingTransform) return;
    isUpdatingTransform = true;
    
    // Get all chart elements
    const chart1Group = d3.select('#chart1 g');
    const chart2Group = d3.select('#chart2 g');
    
    if (chart1Group.empty() || chart2Group.empty()) {
        isUpdatingTransform = false;
        return;
    }
    
    // Get original scales from the stored data
    const chart1Data = chart1Group.datum();
    const chart2Data = chart2Group.datum();
    
    if (!chart1Data || !chart2Data) {
        isUpdatingTransform = false;
        return;
    }
    
    const xScale = chart1Data.xScale;
    const yScale = chart1Data.yScale;
    const y2Scale = chart2Data.y2Scale;
    const width = chart1Data.width;
    const height1 = chart1Data.height1;
    const height2 = chart2Data.height2;
    
    // Create synchronized transforms
    // X-axis: shared zoom and pan
    const newXScale = sharedXTransform.rescaleX(xScale);
    
    // Y-axis: shared zoom scale but independent pan
    const chart1YTransform = d3.zoomIdentity.translate(0, chart1YPan).scale(sharedZoomScale);
    const chart2YTransform = d3.zoomIdentity.translate(0, chart2YPan).scale(sharedZoomScale);
    const newY1Scale = chart1YTransform.rescaleY(yScale);
    const newY2Scale = chart2YTransform.rescaleY(y2Scale);
    
    // Update axes for both charts
    chart1Group.select('.x-axis')
        .call(d3.axisBottom(newXScale));
    chart1Group.select('.y-axis')
        .call(d3.axisLeft(newY1Scale));
    
    chart2Group.select('.x-axis')
        .call(d3.axisBottom(newXScale));
    chart2Group.select('.y-axis')
        .call(d3.axisLeft(newY2Scale));
    
    // Remove ALL grid-related elements properly
    chart1Group.selectAll('.grid-line-x, .grid-line-y, .axis-zero-x, .axis-zero-y').remove();
    chart2Group.selectAll('.grid-line-x, .grid-line-y, .axis-zero-x, .axis-zero-y').remove();
    
    // Add grid lines
    addGridLines(chart1Group, newXScale, newY1Scale, width, height1);
    addGridLines(chart2Group, newXScale, newY2Scale, width, height2);
    
    // Update function line - use the stored data to ensure it doesn't disappear
    const functionPath = chart1Group.select('.function-line');
    if (!functionPath.empty() && chart1Data.data) {
        functionPath
            .datum(chart1Data.data)  // Re-bind the data
            .attr('d', d3.line()
                .x(d => newXScale(d.x))
                .y(d => newY1Scale(d.y))
            );
    }
    
    // Update derivative line - use the stored data to ensure it doesn't disappear
    const derivativePath = chart2Group.select('.derivative-line');
    if (!derivativePath.empty() && chart2Data.derivArr) {
        derivativePath
            .datum(chart2Data.derivArr)  // Re-bind the data
            .attr('d', d3.line()
                .x(d => newXScale(d.x))
                .y(d => newY2Scale(d.dy))
            );
    }
    
    // Update derivative background regions
    const zeroY2 = newY2Scale(0);
    chart2Group.select('.positive-region')
        .attr('y', 0)
        .attr('height', Math.max(0, zeroY2));
    chart2Group.select('.negative-region')
        .attr('y', zeroY2)
        .attr('height', Math.max(0, height2 - zeroY2));
    
    // Update zoom overlays to reflect current combined transform
    const chart1CombinedTransform = d3.zoomIdentity
        .translate(sharedXTransform.x, chart1YPan)
        .scale(sharedZoomScale);
    const chart2CombinedTransform = d3.zoomIdentity
        .translate(sharedXTransform.x, chart2YPan)
        .scale(sharedZoomScale);
    
    chart1Group.select('.zoom-overlay').call(
        chart1Data.zoom1.transform, chart1CombinedTransform
    );
    chart2Group.select('.zoom-overlay').call(
        chart2Data.zoom2.transform, chart2CombinedTransform
    );
    
    isUpdatingTransform = false;
}

function addGridLines(group, xScale, yScale, width, height) {
    // X grid lines - use data binding to avoid duplicates
    const xTicks = xScale.ticks();
    group.selectAll('.grid-line-x')
        .data(xTicks)
        .join('line')
        .attr('class', 'grid-line-x')
        .attr('x1', d => xScale(d))
        .attr('x2', d => xScale(d))
        .attr('y1', 0)
        .attr('y2', height)
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 0.5);
    
    // Y grid lines - use data binding to avoid duplicates
    const yTicks = yScale.ticks();
    group.selectAll('.grid-line-y')
        .data(yTicks)
        .join('line')
        .attr('class', 'grid-line-y')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', d => yScale(d))
        .attr('y2', d => yScale(d))
        .attr('stroke', '#e0e0e0')
        .attr('stroke-width', 0.5);
    
    // Highlight x=0 line (only if 0 is in domain)
    if (xScale.domain()[0] <= 0 && xScale.domain()[1] >= 0) {
        group.selectAll('.axis-zero-x')
            .data([0])
            .join('line')
            .attr('class', 'axis-zero-x')
            .attr('x1', xScale(0))
            .attr('x2', xScale(0))
            .attr('y1', 0)
            .attr('y2', height)
            .attr('stroke', '#666')
            .attr('stroke-width', 1);
    }
    
    // Highlight y=0 line (only if 0 is in domain)
    if (yScale.domain()[0] <= 0 && yScale.domain()[1] >= 0) {
        group.selectAll('.axis-zero-y')
            .data([0])
            .join('line')
            .attr('class', 'axis-zero-y')
            .attr('x1', 0)
            .attr('x2', width)
            .attr('y1', yScale(0))
            .attr('y2', yScale(0))
            .attr('stroke', '#666')
            .attr('stroke-width', 1);
    }
}

function plot(eqn) {
    renderEquations(eqn);
    const expr = math.compile(eqn);
    const dexpr = math.derivative(eqn, 'x').compile();

    // Generate data with extended range for better zoom experience
    const xs = d3.range(-20, 20.01, 0.05);
    const data = xs.map(x => ({ x, y: expr.evaluate({ x }) }));
    const derivArr = xs.map(x => ({ x, dy: dexpr.evaluate({ x }) }));

    const margin = { top: 20, right: 30, bottom: 30, left: 40 };
    const width = 700 - margin.left - margin.right;

    // Clear existing content
    d3.selectAll('#chart1 > *').remove();
    d3.selectAll('#chart2 > *').remove();

    // Calculate centered domains
    const domains = calculateCenteredDomains(data, derivArr);
    
    // Create scales with centered domains
    const xScale = d3.scaleLinear().domain(domains.xDomain).range([0, width]);
    const yScale = d3.scaleLinear().domain(domains.yDomain).range([300 - margin.top - margin.bottom, 0]);
    const y2Scale = d3.scaleLinear().domain(domains.dyDomain).range([200 - margin.top - margin.bottom, 0]);

    const height1 = 300 - margin.top - margin.bottom;
    const height2 = 200 - margin.top - margin.bottom;

    // Create chart groups
    const g1 = d3.select('#chart1').append('g').attr('transform', `translate(${margin.left},${margin.top})`);
    const g2 = d3.select('#chart2').append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // Add derivative background regions for chart2
    const zeroY2 = y2Scale(0);
    g2.append('rect')
        .attr('class', 'positive-region')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', Math.max(0, zeroY2))
        .attr('fill', '#d4edda');
    
    g2.append('rect')
        .attr('class', 'negative-region')
        .attr('x', 0)
        .attr('y', zeroY2)
        .attr('width', width)
        .attr('height', Math.max(0, height2 - zeroY2))
        .attr('fill', '#f8d7da');

    // Add grid lines
    addGridLines(g1, xScale, yScale, width, height1);
    addGridLines(g2, xScale, y2Scale, width, height2);

    // Add axes - x-axis at bottom, y-axis at left
    g1.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height1})`)
        .call(d3.axisBottom(xScale));
    g1.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(yScale));

    g2.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0,${height2})`)
        .call(d3.axisBottom(xScale));
    g2.append('g')
        .attr('class', 'y-axis')
        .call(d3.axisLeft(y2Scale));

    // Add function lines
    g1.append('path')
        .datum(data)
        .attr('class', 'line function-line')
        .attr('d', d3.line()
            .x(d => xScale(d.x))
            .y(d => yScale(d.y))
        );

    g2.append('path')
        .datum(derivArr)
        .attr('class', 'line derivative-line')
        .attr('d', d3.line()
            .x(d => xScale(d.x))
            .y(d => y2Scale(d.dy))
        );

    // Hover elements
    const hoverCircle = g1.append('circle').attr('r', 5).style('display', 'none');
    const tangentLine = g1.append('line').style('display', 'none');
    const slopeText = g1.append('text').style('display', 'none');
    const hoverCircle2 = g2.append('circle').attr('r', 5).style('display', 'none');
    const derivText = g2.append('text').style('display', 'none');
    
    // Array of hover elements for easy management
    const hoverElements = [hoverCircle, tangentLine, slopeText, hoverCircle2, derivText];

    // Create zoom behaviors for each chart
    const zoom1 = createZoomBehavior(g1, true, xScale, yScale, width, height1, hoverElements);
    const zoom2 = createZoomBehavior(g2, false, xScale, y2Scale, width, height2, hoverElements);

    // Store data and zoom behaviors on chart groups for access in update function
    g1.datum({
        xScale: xScale,
        yScale: yScale,
        width: width,
        height1: height1,
        zoom1: zoom1,
        data: data,
        expr: expr,
        dexpr: dexpr
    });
    
    g2.datum({
        xScale: xScale,
        y2Scale: y2Scale,
        width: width,
        height2: height2,
        zoom2: zoom2,
        derivArr: derivArr,
        expr: expr,
        dexpr: dexpr
    });

    // Add zoom overlay rectangles
    const overlay1 = g1.append('rect')
        .attr('class', 'zoom-overlay')
        .attr('width', width)
        .attr('height', height1)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .style('cursor', 'move')
        .call(zoom1);

    const overlay2 = g2.append('rect')
        .attr('class', 'zoom-overlay')
        .attr('width', width)
        .attr('height', height2)
        .attr('fill', 'none')
        .attr('pointer-events', 'all')
        .style('cursor', 'move')
        .call(zoom2);

    const bisect = d3.bisector(d => d.x).left;

    // Track current snapped position
    let currentSnappedX = null;
    const epsilonDy = 0.1;
    const epsilonX = 0.1;

    function attachHoverBehavior(overlay, height) {
        overlay
            .on('mouseover', () => {
                if (!isDragging) {
                    hoverCircle.style('display', null);
                    tangentLine.style('display', null);
                    slopeText.style('display', null);
                    hoverCircle2.style('display', null);
                    derivText.style('display', null);
                }
            })
            .on('mouseout', () => {
                hoverCircle.style('display', 'none');
                tangentLine.style('display', 'none');
                slopeText.style('display', 'none');
                hoverCircle2.style('display', 'none');
                derivText.style('display', 'none');
                currentSnappedX = null;
            })
            .on('mousemove', event => {
                if (isDragging) return; // Don't show hover elements while dragging
                
                const [mx] = d3.pointer(event, overlay.node());
                
                // Create current scales using the shared zoom and individual pans
                const currentXScale = sharedXTransform.rescaleX(xScale);
                const chart1YTransform = d3.zoomIdentity.translate(0, chart1YPan).scale(sharedZoomScale);
                const chart2YTransform = d3.zoomIdentity.translate(0, chart2YPan).scale(sharedZoomScale);
                const currentYScale = chart1YTransform.rescaleY(yScale);
                const currentY2Scale = chart2YTransform.rescaleY(y2Scale);
                
                let x0 = currentXScale.invert(mx);
                
                // Find candidates for snapping (points with near-zero derivative)
                const candidates = derivArr.filter(d => Math.abs(d.dy) < epsilonDy);
                
                // Check if we should snap to a zero-slope point
                let shouldSnap = false;
                let snapTarget = null;
                
                if (currentSnappedX !== null) {
                    // If we're already snapped, check if mouse is still within snap range
                    const snapCandidate = candidates.find(d => Math.abs(d.x - currentSnappedX) < 0.01);
                    if (snapCandidate && Math.abs(x0 - currentSnappedX) < epsilonX * 2) {
                        shouldSnap = true;
                        snapTarget = snapCandidate;
                    } else {
                        currentSnappedX = null; // Release snap
                    }
                } else {
                    // Not currently snapped, check if we should snap to a nearby zero-slope point
                    const nearbyCandidate = candidates.find(d => Math.abs(d.x - x0) < epsilonX);
                    if (nearbyCandidate) {
                        shouldSnap = true;
                        snapTarget = nearbyCandidate;
                        currentSnappedX = nearbyCandidate.x;
                    }
                }
                
                if (shouldSnap && snapTarget) {
                    x0 = snapTarget.x;
                }
                
                const y0 = expr.evaluate({ x: x0 });
                const rawDy = dexpr.evaluate({ x: x0 });
                const m = Math.abs(rawDy) < epsilonDy ? 0 : rawDy;
                const color = m === 0 ? 'grey' : (m > 0 ? 'green' : 'red');
                const fill = m === 0 ? 'lightgrey' : (m > 0 ? '#c3e6cb' : '#f5c6cb');

                hoverCircle.attr('cx', currentXScale(x0)).attr('cy', currentYScale(y0)).attr('fill', fill).attr('stroke', color);
                tangentLine.attr('x1', currentXScale(x0 - 1)).attr('y1', currentYScale(y0 - m)).attr('x2', currentXScale(x0 + 1)).attr('y2', currentYScale(y0 + m)).style('stroke', color);
                slopeText.attr('x', currentXScale(x0) + 5).attr('y', currentYScale(y0) - 5).attr('fill', color).text('m = ' + m.toFixed(2));

                hoverCircle2.attr('cx', currentXScale(x0)).attr('cy', currentY2Scale(m));
                derivText.attr('x', currentXScale(x0) + 5).attr('y', currentY2Scale(m) - 5).text('y = ' + m.toFixed(2));
            });
    }

    // Attach hover behavior to both overlays
    attachHoverBehavior(overlay1, height1);
    attachHoverBehavior(overlay2, height2);

    // Reset zoom transforms
    sharedXTransform = d3.zoomIdentity;
    sharedZoomScale = 1;
    chart1YPan = 0;
    chart2YPan = 0;
}

// Initialize the application
function initializeApp() {
    // Wait for MathJax to be ready before plotting
    if (window.MathJax) {
        MathJax.startup.promise.then(() => {
            plot(document.getElementById('equation').value);
        });
    } else {
        plot(document.getElementById('equation').value);
    }
    
    // Add event listener for the plot button
    document.getElementById('updateBtn').addEventListener('click', () => {
        plot(document.getElementById('equation').value);
    });
}

// Initialize when page loads
window.addEventListener('load', initializeApp);