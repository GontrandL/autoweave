
// Modified utilities  
function formatDate(date, includeTime = false) {
    if (includeTime) {
        return date.toISOString();
    }
    return date.toISOString().split('T')[0];
}
