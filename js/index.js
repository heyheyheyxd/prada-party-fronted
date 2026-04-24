document.addEventListener("DOMContentLoaded", () => {
    setTimeout(() => {
        const input = document.getElementById("globalSearchInput");
        if (!input) return;

        input.addEventListener("keyup", (e) => {
            if (e.key === "Enter") {
                const query = input.value.trim();
                if (query !== "") {
                    window.location.href = `catalog.html?search=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = `catalog.html`;
                }
            }
        });
    }, 200); // ждём пока header подгрузится
});
