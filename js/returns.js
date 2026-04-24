document.querySelectorAll(".returns-header").forEach(header => {
    header.addEventListener("click", () => {
        const item = header.parentElement;
        item.classList.toggle("open");
    });
});
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