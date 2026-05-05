function wishlistPage() {
    return {
        items: [],
        similar: [],
        loading: true,
        query: "",
        searchMessage: "",
        noResults: false,

        showToast(message) {
            const container = document.getElementById("toast-container");
            if (!container) return;

            const toast = document.createElement("div");
            toast.className = "toast";
            toast.textContent = message;

            container.appendChild(toast);

            setTimeout(() => toast.classList.add("show"), 10);

            setTimeout(() => {
                toast.classList.remove("show");
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        async loadWishlist() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) {
                this.items = [];
                localStorage.setItem("wishlist", "[]");
                window.dispatchEvent(new Event("wishlist-updated"));
                this.similar = [];
                this.loading = false;
                return;
            }

            try {
                const records = await pb.collection("wishlist").getFullList({
                    filter: `user = "${pb.authStore.model.id}"`,
                    expand: 'product'
                });

                this.items = records.map(r => ({
                    id: r.expand?.product?.id || r.product,
                    title: r.expand?.product?.title || 'Без названия',
                    brand: r.expand?.product?.brand || 'Бренд',
                    price: r.expand?.product?.price || 0,
                    image: r.expand?.product?.image 
                        ? pb.files.getURL(r.expand.product, r.expand.product.image)
                        : '',
                    image2: r.expand?.product?.image2 
                        ? pb.files.getURL(r.expand.product, r.expand.product.image2)
                        : '',
                    size: r.size || "",
                    sizes: r.expand?.product?.sizes || [],
                    category: r.expand?.product?.category || '',
                    wishlistRecordId: r.id,
                    in_stock: r.expand?.product?.in_stock ?? true
                }));

                localStorage.setItem("wishlist", JSON.stringify(this.items));

            } catch (err) {
                console.error("Ошибка загрузки wishlist:", err);
                this.items = JSON.parse(localStorage.getItem("wishlist") || "[]");
            }

            window.dispatchEvent(new Event("wishlist-updated"));

            this.loading = false;

            await this.loadSimilar();

            
            const input = document.getElementById("globalSearchInput");
            if (input) input.value = "";

            this.initGlobalSearch();
        },

        
        pluralize(count) {
            const mod10 = count % 10;
            const mod100 = count % 100;

            if (mod10 === 1 && mod100 !== 11) return "товар";
            if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "товара";
            return "товаров";
        },

        
        searchLocal() {
            const q = this.query.trim().toLowerCase();

            if (q === "") {
                this.items = JSON.parse(localStorage.getItem("wishlist") || "[]");
                this.noResults = false;
                this.searchMessage = "";
                return;
            }

            const all = JSON.parse(localStorage.getItem("wishlist") || "[]");

            this.items = all.filter(item =>
                item.title.toLowerCase().includes(q) ||
                item.brand.toLowerCase().includes(q)
            );

            if (this.items.length === 0) {
                this.noResults = true;
                this.searchMessage = "По вашему запросу ничего не найдено";
            } else {
                this.noResults = false;
                const count = this.items.length;
                this.searchMessage = `По вашему запросу найдено: ${count} ${this.pluralize(count)}`;
            }
        },

        saveWishlist() {
            localStorage.setItem("wishlist", JSON.stringify(this.items));
            window.dispatchEvent(new Event("wishlist-updated"));
        },

        async loadSimilar() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (this.items.length === 0) {
                this.similar = [];
                return;
            }

            const brands = [...new Set(this.items.map(i => i.brand))];

            try {
                const records = await pb.collection("products").getFullList({
                    filter: `(${brands.map(b => `brand = "${b}"`).join(" || ")}) && in_stock = true`
                });

                const wishlistIds = new Set(this.items.map(i => i.id));
                let filtered = records.filter(p => !wishlistIds.has(p.id));

                for (let i = filtered.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
                }

                filtered = filtered.slice(0, 4);

                this.similar = filtered.map(item => ({
                    id: item.id,
                    title: item.title,
                    brand: item.brand,
                    price: item.price,
                    image: pb.files.getURL(item, item.image),
                    image2: item.image2
                        ? pb.files.getURL(item, item.image2)
                        : pb.files.getURL(item, item.image)
                }));

            } catch (err) {
                console.error("Ошибка загрузки похожих товаров:", err);
                this.similar = [];
            }
        },

        async removeItem(index) {
            const pb = new PocketBase("http://127.0.0.1:8090");

            const recordId = this.items[index].wishlistRecordId;

            if (recordId) {
                try {
                    await pb.collection("wishlist").delete(recordId);
                } catch (err) {
                    console.error("Ошибка удаления из PB:", err);
                }
            }

            this.items.splice(index, 1);
            this.saveWishlist();
            this.showToast("Удалено из избранного");

            await this.loadSimilar();
        },

        async addToCart(index) {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) {
                alert("Войдите в аккаунт");
                window.location.href = "login.html";
                return;
            }

            const item = this.items[index];
            const size = item.size || "";

            let cart = JSON.parse(localStorage.getItem("cart") || "[]");

            const existing = cart.find(
                x => x.id === item.id && (x.size || "") === size
            );

            if (existing) {
                existing.quantity++;

                try {
                    await pb.collection("cart").delete(existing.cartRecordId);
                } catch (err) {
                    console.error("Ошибка удаления старой PB записи:", err);
                }

                let newRecord;
                try {
                    newRecord = await pb.collection("cart").create({
                        user: pb.authStore.model.id,
                        product: item.id,
                        size: size,
                        quantity: existing.quantity
                    });
                } catch (err) {
                    console.error("Ошибка создания новой PB записи:", err);
                    this.showToast("Ошибка при добавлении в корзину");
                    return;
                }

                existing.cartRecordId = newRecord.id;

                localStorage.setItem("cart", JSON.stringify(cart));
                window.dispatchEvent(new Event("cart-updated"));

                this.showToast("Количество товара увеличено");
                return;
            }

            let record;
            try {
                record = await pb.collection("cart").create({
                    user: pb.authStore.model.id,
                    product: item.id,
                    size: size,
                    quantity: 1
                });
            } catch (err) {
                console.error("Ошибка PB:", err);
                this.showToast("Ошибка при добавлении в корзину");
                return;
            }

            cart.push({
                id: item.id,
                title: item.title,
                brand: item.brand,
                price: item.price,
                image: item.image,
                size: size,
                quantity: 1,
                cartRecordId: record.id
            });

            localStorage.setItem("cart", JSON.stringify(cart));
            window.dispatchEvent(new Event("cart-updated"));

            this.showToast("Товар добавлен в корзину");
        },

        
        initGlobalSearch() {
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

    };
}
