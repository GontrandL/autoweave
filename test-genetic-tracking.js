// Test du tracking génétique intelligent
// Gene ID: AWF-20250111-091800-TST-DEDUP

function calculateSum(a, b) {
    return a + b;
}

function formatDate(date) {
    return date.toISOString().split('T')[0];
}

// Cette fonction sera un doublon intentionnel
function calculateSum(x, y) {
    return x + y;  // Même logique, noms différents
}