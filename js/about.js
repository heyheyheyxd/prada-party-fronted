function initGlobalSearch() {
    setTimeout(() => {
        const input = document.getElementById("globalSearchInput");
        if (!input) return;

        input.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                const q = input.value.trim();
                window.location.href = `catalog.html?search=${encodeURIComponent(q)}`;
            }
        });
    }, 200);
}

document.addEventListener("DOMContentLoaded", initGlobalSearch);