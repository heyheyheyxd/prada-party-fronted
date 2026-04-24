async function loadComponent(id, file) {
    try {
        const response = await fetch(`/components/${file}`);
        const html = await response.text();

        const container = document.getElementById(id);
        if (!container) return;

        container.innerHTML = html;

        if (window.Alpine) {
            Alpine.initTree(container);
        }

    } catch (error) {
        console.error("Ошибка загрузки компонента:", error);
    }
}

loadComponent("header", "header.html");
loadComponent("footer", "footer.html");



// Популярные товары
async function loadPopularProducts() {
    const container = document.getElementById("popular-products");
    if (!container) return;

    const pb = new PocketBase("http://127.0.0.1:8090");

    // 1. Получаем все популярные товары в наличии
    const products = await pb.collection("products").getFullList({
        filter: 'popular = true && in_stock = true'
    });

    // 2. Перемешиваем массив
    for (let i = products.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [products[i], products[j]] = [products[j], products[i]];
    }

    // 3. Берём первые 4
    const selected = products.slice(0, 4);

    // 4. Рендерим
    container.innerHTML = "";

    selected.forEach(product => {
        const image1 = pb.files.getURL(product, product.image);
        const image2 = product.image2
            ? pb.files.getURL(product, product.image2)
            : image1;

        container.innerHTML += `
            <a href="product.html?id=${product.id}" class="product-card">
                <div class="product-image">
                    <img class="img-main" src="${image1}" alt="${product.title}">
                    <img class="img-hover" src="${image2}" alt="${product.title}">
                </div>
                <p class="brand">${product.brand}</p>
                <p class="title">${product.title}</p>
                <p class="price">${product.price} ₽</p>
            </a>
        `;
    });
}



document.addEventListener("DOMContentLoaded", () => {
    loadPopularProducts();
});
