
// Utility functions
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

function parseJSON(str) {
    try {
        return JSON.parse(str);
    } catch (e) {
        return null;
    }
}
