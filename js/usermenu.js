function userMenu() {
    return {
        isLoggedIn: false,
        email: "",
        first_name: "",
        displayName: "",

        cartCount: 0,
        wishlistCount: 0,

        async init() {
            const pb = new PocketBase('http://127.0.0.1:8090');

            this.isLoggedIn = pb.authStore.isValid;

            // 1. Если пользователь авторизован — загружаем актуальные данные
            if (this.isLoggedIn && pb.authStore.model) {
                let user;

                try {
                    //  Загружаем актуальные данные пользователя из PB
                    user = await pb.collection("users").getOne(pb.authStore.model.id);
                } catch (err) {
                    console.error("Ошибка загрузки пользователя:", err);
                    user = pb.authStore.model; 
                }

                this.email = user.email;
                this.first_name = user.first_name || "";
                this.avatar = user.avatar
                ? `http://127.0.0.1:8090/api/files/users/${user.id}/${user.avatar}`
                : "../img/people.jpg";

                //  Если есть имя — показываем имя, иначе email
                this.displayName = this.first_name !== ""
                    ? this.first_name
                    : this.email;

                // 2. Синхронизируем wishlist/cart из PB
                await this.syncWishlistFromPB();
                await this.syncCartFromPB();
            }
            // 3. Обновляем счётчики
            this.updateCartCount();
            this.updateWishlistCount();

            // 4. Слушаем события
            window.addEventListener('storage', () => {
                this.updateCartCount();
                this.updateWishlistCount();
            });

            window.addEventListener('cart-updated', () => this.updateCartCount());
            window.addEventListener('wishlist-updated', () => this.updateWishlistCount());
        },

        // СИНХРОНИЗАЦИЯ WISHLIST
        async syncWishlistFromPB() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) return;

            let items = [];

            try {
                const records = await pb.collection("wishlist").getFullList({
                    filter: `user = "${pb.authStore.model.id}"`
                });

                for (const rec of records) {
                    items.push({
                        id: rec.product,
                        size: rec.size || "",
                        wishlistRecordId: rec.id
                    });
                }
            } catch (err) {
                console.error("Ошибка загрузки wishlist из PB:", err);
            }

            localStorage.setItem("wishlist", JSON.stringify(items));
        },

        // СИНХРОНИЗАЦИЯ CART
        async syncCartFromPB() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) return;

            let items = [];

            try {
                const records = await pb.collection("cart").getFullList({
                    filter: `user = "${pb.authStore.model.id}"`
                });

                for (const rec of records) {
                    items.push({
                        id: rec.product,
                        size: rec.size || "",
                        quantity: rec.quantity,
                        cartRecordId: rec.id
                    });
                }
            } catch (err) {
                console.error("Ошибка загрузки cart из PB:", err);
            }

            localStorage.setItem("cart", JSON.stringify(items));
        },

        // ОБНОВЛЕНИЕ СЧЁТЧИКОВ
        updateCartCount() {
            const cart = JSON.parse(localStorage.getItem("cart") || "[]");
            this.cartCount = cart.reduce((sum, item) => sum + (item.quantity || 1), 0);
        },

        updateWishlistCount() {
            const wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");
            this.wishlistCount = wishlist.length;
        },
        // ВЫХОД
        logout() {
            const pb = new PocketBase('http://127.0.0.1:8090');
            localStorage.removeItem("wishlist");
            localStorage.removeItem("cart");

            pb.authStore.clear();
            window.location.href = "index.html";
        }
    }
}
