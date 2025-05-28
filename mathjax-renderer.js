// MathJax rendering and scaling functionality

// Simple layout switching based on width comparison
function scaleEquationsToFit() {
    const equations = document.querySelectorAll('.equation-left');
    
    equations.forEach(container => {
        const mjxMath = container.querySelector('mjx-math');
        if (!mjxMath) return;
        
        const chartContainer = container.parentNode;
        
        // Get dimensions
        const containerWidth = container.offsetWidth;
        const mathWidth = mjxMath.scrollWidth;
        
        if (mathWidth > containerWidth) {
            // Math is too wide, switch to stacked layout
            chartContainer.classList.remove('side-by-side-layout');
            chartContainer.classList.add('stacked-layout');
        } else {
            // Math fits, use side-by-side layout
            chartContainer.classList.remove('stacked-layout');
            chartContainer.classList.add('side-by-side-layout');
        }
        
        // Reset any previous styling
        // const mjxContainer = container.querySelector('mjx-container');
        // if (mjxContainer) {
        //     mjxContainer.style.fontSize = '';
        //     mjxContainer.style.transform = '';
        //     mjxContainer.style.transformOrigin = '';
        // }
    });
}

function renderEquations(eqn) {
    // Use AsciiMath notation with backticks
    const fxAscii = `\`f(x) = ${eqn}\``;
    
    // Get derivative and render with AsciiMath
    const dexprStr = math.derivative(eqn, 'x').toString();
    const dAscii = `\`f'(x) = ${dexprStr}\``;
    
    // Set the HTML content
    document.getElementById('render-fx').innerHTML = fxAscii;
    document.getElementById('render-fpx').innerHTML = dAscii;
    
    // Render with MathJax
    if (window.MathJax && MathJax.typesetPromise) {
        MathJax.typesetPromise([document.getElementById('render-fx'), document.getElementById('render-fpx')])
            .then(() => {
                // Wait for rendering to complete, then check layout
                setTimeout(() => {
                    scaleEquationsToFit();
                }, 50);
            })
            .catch((err) => console.log('MathJax typeset failed: ' + err.message));
    }
}

// Debounced resize handler
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
        scaleEquationsToFit();
    }, 100);
});