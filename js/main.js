async function loadComponent(id, file) {
    try {
        const response = await fetch(`components/${file}`);
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



async function getTopPurchasedProductIds(limit = 4) {
    const pb = new PocketBase("https://prada-party.onrender.com");
    const orders = await pb.collection("orders").getFullList();

    const counts = new Map();

    orders.forEach(order => {
        if (!Array.isArray(order.items)) return;

        order.items.forEach(item => {
            const productId = item.id || item.product;
            if (!productId) return;

            const quantity = Number(item.quantity ?? 1) || 1;
            counts.set(productId, (counts.get(productId) || 0) + quantity);
        });
    });

    return [...counts.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([productId]) => productId);
}

// Популярные товары по числу покупок
async function loadPopularProducts() {
    const container = document.getElementById("popular-products");
    if (!container) return;

    const pb = new PocketBase("https://prada-party.onrender.com");
    const topIds = await getTopPurchasedProductIds(4);

    let products = [];

    if (topIds.length > 0) {
        const filter = topIds.map(id => `id = "${id}"`).join(" || ");
        products = await pb.collection("products").getFullList({
            filter: `in_stock = true && (${filter})`
        });
        products.sort((a, b) => topIds.indexOf(a.id) - topIds.indexOf(b.id));
    }

    if (products.length === 0) {
        products = await pb.collection("products").getFullList({
            filter: 'popular = true && in_stock = true'
        });
    }

    const selected = products.slice(0, 4);

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
