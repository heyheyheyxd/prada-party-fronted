function cartPage() {
    return {
        items: [],
        recommended: [],
        loading: true,

        async loadCart() {
            const pb = new PocketBase("https://prada-party.onrender.com");
            const user = pb.authStore.model;

            let localCart = JSON.parse(localStorage.getItem("cart") || "[]");
            let serverCart = [];

            if (user) {
                try {
                    const records = await pb.collection("cart").getFullList({
                        filter: `user = "${user.id}"`
                    });

                    for (const rec of records) {
                        const product = await pb.collection("products").getOne(rec.product);

                        serverCart.push({
                            id: product.id,
                            title: product.title,
                            brand: product.brand,
                            price: product.price,
                            image: pb.files.getURL(product, product.image),
                            size: rec.size || "",
                            quantity: rec.quantity,
                            cartRecordId: rec.id,
                            in_stock: product.in_stock ?? true,
                            selected: true
                        });
                    }
                } catch (err) {
                    console.error("Ошибка загрузки корзины из PB:", err);
                }
            }

            if (!user) {
                this.items = localCart.map(i => ({ ...i, selected: true }));
                window.dispatchEvent(new Event("cart-updated"));
                this.loading = false;
                await this.loadRecommended();
                this.initGlobalSearch();
                return;
            }

            const map = new Map();
            const key = (i) => `${i.id}__${i.size || ""}`;

            for (const item of serverCart) {
                map.set(key(item), item);
            }

            for (const item of localCart) {
                const k = key(item);

                if (!map.has(k)) {
                    let rec = await pb.collection("cart").create({
                        user: user.id,
                        product: item.id,
                        size: item.size || "",
                        quantity: item.quantity
                    });

                    map.set(k, {
                        ...item,
                        cartRecordId: rec.id,
                        selected: true
                    });
                }
            }

            const final = Array.from(map.values());

            this.items = final;
            localStorage.setItem("cart", JSON.stringify(final));
            window.dispatchEvent(new Event("cart-updated"));

            this.loading = false;

            await this.loadRecommended();

            
            this.initGlobalSearch();
        },

        saveCart() {
            localStorage.setItem("cart", JSON.stringify(this.items));
            window.dispatchEvent(new Event('cart-updated'));
        },

        formatPrice(value) {
            if (!value) return "0";
            return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        totalItems() {
            return this.items
                .filter(i => i.selected)
                .reduce((sum, item) => sum + (item.quantity || 1), 0);
        },

        totalPrice() {
            return this.items
                .filter(i => i.selected)
                .reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        },

        canCheckout() {
            return !this.items.some(i => i.selected && !i.in_stock);
        },

        async increaseQty(index) {
            const pb = new PocketBase("https://prada-party.onrender.com");

            this.items[index].quantity++;

            await pb.collection("cart").update(this.items[index].cartRecordId, {
                quantity: this.items[index].quantity
            });

            this.saveCart();
        },

        async decreaseQty(index) {
            const pb = new PocketBase("https://prada-party.onrender.com");

            if (this.items[index].quantity > 1) {
                this.items[index].quantity--;

                await pb.collection("cart").update(this.items[index].cartRecordId, {
                    quantity: this.items[index].quantity
                });

                this.saveCart();
            }
        },

        async removeItem(index) {
            const pb = new PocketBase("https://prada-party.onrender.com");

            await pb.collection("cart").delete(this.items[index].cartRecordId);

            this.items.splice(index, 1);
            this.saveCart();
        },

        async clearCart() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            for (const item of this.items) {
                await pb.collection("cart").delete(item.cartRecordId);
            }

            this.items = [];
            this.saveCart();
        },

        async loadRecommended() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            try {
                const products = await pb.collection("products").getFullList({
                    filter: 'popular = true && in_stock = true'
                });

                for (let i = products.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [products[i], products[j]] = [products[j], products[i]];
                }

                const selected = products.slice(0, 4);

                this.recommended = selected.map(item => ({
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
                console.error("Ошибка загрузки рекомендаций:", err);
                this.recommended = [];
            }
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
