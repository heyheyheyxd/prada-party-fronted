function shoesPage() {
    return {
        items: [],
        allItems: [],
        query: "",
        searchMessage: "",
        noResults: false,
        priceMin: 0,
        priceMax: 200000,
        sortBy: "",

        async loadShoes() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            const records = await pb.collection("products").getFullList({
                filter: 'gender = "women"'
            });

            this.allItems = records.map(item => this.mapItem(item));
            this.items = this.allItems;

            const input = document.getElementById("globalSearchInput");
            if (input) input.value = "";

            this.updatePriceBar();
        },

        pluralize(count) {
            const mod10 = count % 10;
            const mod100 = count % 100;

            if (mod10 === 1 && mod100 !== 11) return "товар";
            if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return "товара";
            return "товаров";
        },

        applyFilters() {

            if (this.priceMin > 200000) this.priceMin = 200000;
            if (this.priceMax > 200000) this.priceMax = 200000;

            if (this.priceMin < 0) this.priceMin = 0;
            if (this.priceMax < 0) this.priceMax = 0;

            if (this.priceMin > this.priceMax) {
                this.priceMin = this.priceMax;
            }

            let result = [...this.allItems];

            const q = this.query.trim().toLowerCase();
            if (q !== "") {
                result = result.filter(item =>
                    item.title.toLowerCase().includes(q) ||
                    item.brand.toLowerCase().includes(q)
                );
            }

            result = result.filter(item =>
                item.price >= this.priceMin && item.price <= this.priceMax
            );

            if (this.sortBy === "price_asc") {
                result.sort((a, b) => a.price - b.price);
            }
            if (this.sortBy === "price_desc") {
                result.sort((a, b) => b.price - a.price);
            }

            if (this.priceMin === 0 && this.priceMax === 200000 && this.query.trim() === "") {
    
                this.searchMessage = "";
                this.noResults = false;
                this.items = result;
                 return;
            }

            if (result.length === 0) {
                this.noResults = true;
                this.searchMessage = "По вашему запросу ничего не найдено";
            } else {
                this.noResults = false;
                const count = result.length;
                this.searchMessage = `Найдено: ${count} ${this.pluralize(count)}`;
            }

            this.items = result;
            this.updatePriceBar();
        },

        syncPriceRange(which) {
            if (this.priceMin > 200000) this.priceMin = 200000;
            if (this.priceMax > 200000) this.priceMax = 200000;

            if (this.priceMin < 0) this.priceMin = 0;
            if (this.priceMax < 0) this.priceMax = 0;

            if (which === "min" && this.priceMin > this.priceMax) {
                this.priceMin = this.priceMax;
            }
            if (which === "max" && this.priceMax < this.priceMin) {
                this.priceMax = this.priceMin;
            }

            this.applyFilters();
        },

        updatePriceBar() {
            const slider = this.$refs.priceSlider;
            const range = this.$refs.priceRange;
            if (!slider || !range) return;

            const min = 0;
            const max = 200000;

            const leftPercent = ((this.priceMin - min) / (max - min)) * 100;
            const rightPercent = ((this.priceMax - min) / (max - min)) * 100;

            range.style.left = leftPercent + "%";
            range.style.width = (rightPercent - leftPercent) + "%";
        },

        initGlobalSearch() {
            setTimeout(() => {
                const input = document.getElementById("globalSearchInput");
                if (!input) return;

                input.addEventListener("keyup", (e) => {
                    if (e.key === "Enter") {
                        this.query = input.value.trim();
                        this.applyFilters();
                    }
                });
            }, 200);
        },

        mapItem(item) {
            return {
                id: item.id,
                title: item.title,
                brand: item.brand,
                price: item.price,
                image: `https://prada-party.onrender.com/api/files/products/${item.id}/${item.image}`,
                image2: item.image2
                    ? `https://prada-party.onrender.com/api/files/products/${item.id}/${item.image2}`
                    : `https://prada-party.onrender.com/api/files/products/${item.id}/${item.image}`
            };
        }
    }
}
