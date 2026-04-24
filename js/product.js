function productPage() {
  return {

    // Данные товара
    product: {
      id: null,
      title: '',
      brand: '',
      price: 0,
      category: '',
      image: '',
      image2: ''
    },

    sizes: [],
    selectedSize: null,
    error: null,

    showSizeGuide: false,
    sizeGuideData: [],

    openSizeGuide() {
        this.generateSizeGuide();
        this.showSizeGuide = true;
    },

    closeSizeGuide() {
        this.showSizeGuide = false;
    },

    generateSizeGuide() {
        // Если обувь
        if (this.product.category === "shoes") {
            this.sizeGuideData = this.sizes.map(size => ({
                intl: size,
                ru: this.convertShoeSize(size)
            }));
            return;
        }

        // Если одежда
        this.sizeGuideData = this.sizes.map(size => ({
            intl: size,
            ru: this.convertClothingSize(size)
        }));
    },

    convertClothingSize(size) {
        const map = {
            "XXS": "42 (RU)",
            "XS": "44 (RU)",
            "S": "46 (RU)",
            "M": "48 (RU)",
            "L": "50 (RU)",
            "XL": "52 (RU)",
            "XXL": "54 (RU)",
            "XXXL": "56 (RU)"
        };
        return map[size] || "—";
    },

    convertShoeSize(size) {
        const map = {
            "36": "35 (RU)",
            "37": "36 (RU)",
            "38": "37 (RU)",
            "39": "38 (RU)",
            "40": "39 (RU)",
            "41": "40 (RU)",
            "42": "41 (RU)",
            "43": "42 (RU)",
            "44": "43 (RU)",
            "45": "44 (RU)",
            "46": "45 (RU)"
        };
        return map[size] || "—";
    },

    showToast(message) {
        const container = document.getElementById("toast-container");

        const toast = document.createElement("div");
        toast.className = "toast";
        toast.textContent = message;

        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    },

    // ЗАГРУЗКА ТОВАРА
    async loadProduct() {
      const pb = new PocketBase("http://127.0.0.1:8090");

      const params = new URLSearchParams(window.location.search);
      const id = params.get("id");

      if (!id) {
        this.error = "В ссылке отсутствует ID товара";
        return;
      }

      try {
        const item = await pb.collection("products").getOne(id);

        this.product = {
          id: item.id,
          title: item.title || 'Название отсутствует',
          brand: item.brand || 'Бренд не указан',
          price: Number(item.price) || 0,
          category: item.category || '',
          image: pb.files.getURL(item, item.image) || '',
          image2: item.image2
            ? pb.files.getURL(item, item.image2)
            : pb.files.getURL(item, item.image),
          in_stock: item.in_stock ?? true
        };

        this.sizes = Array.isArray(item.sizes) ? item.sizes : [];

      } catch (err) {
        console.error("Ошибка загрузки товара:", err);
        this.error = err.status
          ? `${err.status} — ${err.data?.message || "Не удалось загрузить товар"}`
          : "Не удалось загрузить товар. Проверьте подключение.";
      }
    },

    // ДОБАВИТЬ В КОРЗИНУ
    async addToCart() {
        const pb = new PocketBase("http://127.0.0.1:8090");

        if (!pb.authStore.isValid) {
            this.showToast("Войдите в аккаунт");
            localStorage.setItem("redirectAfterLogin", window.location.href);
            window.location.href = "login.html";
            return;
        }

        const size = this.product.category === 'accessories'
            ? ""
            : (this.selectedSize || "");

        if (this.product.category !== 'accessories' &&
            this.sizes.length > 0 &&
            !size) {
            this.showToast("Выберите размер");
            return;
        }

        const userId = pb.authStore.model.id;

        let existingRecord = null;

        try {
            const records = await pb.collection("cart").getFullList({
                filter: `user = "${userId}" && product = "${this.product.id}" && size = "${size}"`
            });

            if (records.length > 0) {
                existingRecord = records[0];
            }
        } catch (err) {
            console.error("Ошибка поиска товара в PB:", err);
        }

        if (existingRecord) {
            const newQty = existingRecord.quantity + 1;

            try {
                await pb.collection("cart").update(existingRecord.id, {
                    quantity: newQty
                });
            } catch (err) {
                console.error("Ошибка обновления количества:", err);
                this.showToast("Ошибка при обновлении корзины");
                return;
            }

            let cart = JSON.parse(localStorage.getItem("cart") || "[]");

            const item = cart.find(
                x => x.id === this.product.id && (x.size || "") === size
            );

            if (item) {
                item.quantity = newQty;
            }

            localStorage.setItem("cart", JSON.stringify(cart));
            window.dispatchEvent(new Event("cart-updated"));

            this.showToast("Количество товара увеличено");
            return;
        }

        let record;

        try {
            record = await pb.collection("cart").create({
                user: userId,
                product: this.product.id,
                size: size,
                quantity: 1
            });
        } catch (err) {
            console.error("Ошибка PB:", err);
            this.showToast("Ошибка добавления в корзину");
            return;
        }

        let cart = JSON.parse(localStorage.getItem("cart") || "[]");

        cart.push({
            id: this.product.id,
            title: this.product.title,
            brand: this.product.brand,
            price: this.product.price,
            image: this.product.image,
            size: size,
            quantity: 1,
            cartRecordId: record.id
        });

        localStorage.setItem("cart", JSON.stringify(cart));
        window.dispatchEvent(new Event("cart-updated"));

        this.showToast("Товар добавлен в корзину");
    },

    // ДОБАВИТЬ В ИЗБРАННОЕ
    async addToWishlist() {
        const pb = new PocketBase("http://127.0.0.1:8090");

        if (!pb.authStore.isValid) {
            this.showToast("Войдите в аккаунт");
            localStorage.setItem("redirectAfterLogin", window.location.href);
            window.location.href = "login.html";
            return;
        }

        const size = this.product.category === 'accessories' ? "" : (this.selectedSize || "");

        if (this.product.category !== 'accessories' &&
            this.sizes.length > 0 &&
            !size) {
            this.showToast("Выберите размер");
            return;
        }

        const userId = pb.authStore.model.id;

        let existing = [];

        try {
            existing = await pb.collection("wishlist").getFullList({
                filter: `user = "${userId}" && product = "${this.product.id}" && size = "${size}"`
            });
        } catch (err) {
            console.error("Ошибка проверки избранного:", err);
        }

        if (existing.length > 0) {
            this.showToast("Товар уже в избранном");
            return;
        }

        try {
            const record = await pb.collection("wishlist").create({
                user: userId,
                product: this.product.id,
                size: size
            });

            let wishlist = JSON.parse(localStorage.getItem("wishlist") || "[]");

            wishlist.push({
                id: this.product.id,
                title: this.product.title,
                brand: this.product.brand,
                price: this.product.price,
                image: this.product.image,
                image2: this.product.image2 || this.product.image,
                size: size,
                wishlistRecordId: record.id
            });

            localStorage.setItem("wishlist", JSON.stringify(wishlist));
            window.dispatchEvent(new Event("wishlist-updated"));

            this.showToast("Добавлено в избранное");
        } catch (err) {
            console.error("Ошибка добавления в wishlist:", err);
            this.showToast("Не удалось добавить");
        }
    },

    // ДАТЫ ДОСТАВКИ
    getDeliveryDates() {
      const today = new Date();

      const start = new Date(today);
      start.setDate(today.getDate() + 7);

      const end = new Date(today);
      end.setDate(today.getDate() + 11);

      const options = { day: 'numeric', month: 'short' };

      const startStr = start.toLocaleDateString('ru-RU', options);
      const endStr = end.toLocaleDateString('ru-RU', options);

      return `${startStr} — ${endStr}`;
    }
  };
}
