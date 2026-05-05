window.productsSearchHandler = function (query) {
    if (window.productsPanelInstance && window.productsPanelInstance.filterProducts) {
        window.productsPanelInstance.searchExact = false; 
        window.productsPanelInstance.filterProducts(query);
    }
};

window.productsSearchEnter = function (e) {
    if (e.key === "Enter") {
        if (window.productsPanelInstance) {
            window.productsPanelInstance.searchExact = true; 
            window.productsPanelInstance.filterProducts(e.target.value);
        }
    }
};

function productsPanel() {
    const self = {
        tableHtml: "",
        tableLoaded: false,
        products: [],
        selectedProductId: null,
        pendingDeleteId: null,

        searchExact: false, 

        init() {
            window.productsPanelInstance = this;
        },

        showToast(message) {
            const container = document.getElementById("toast-container");
            const toast = document.createElement("div");
            toast.className = "toast";
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },

        showModalError(prefix, message) {
            const box = document.querySelector(`#${prefix}_error`);
            if (!box) return;
            box.textContent = message;
            box.style.display = "block";
        },

        clearModalError(prefix) {
            const box = document.querySelector(`#${prefix}_error`);
            if (!box) return;
            box.textContent = "";
            box.style.display = "none";
        },

        onCategoryChange(prefix) {
            const categoryEl = document.querySelector(`#${prefix}_category`);
            const block = document.querySelector(`#${prefix}_sizes_block`);
            if (!categoryEl || !block) return;

            const category = categoryEl.value;
            block.style.display = category === "accessories" ? "none" : "block";
        },

        async checkAdmin() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) {
                window.location.href = "login.html";
                return;
            }

            const user = await pb.collection("users").getOne(pb.authStore.model.id);

            if (!user.is_admin) {
                alert("У вас нет прав администратора");
                window.location.href = "index.html";
                return;
            }

            this.loadProducts();
        },

        
        renderProductsTable(list) {
            let html = `
                <h2>Товары</h2>
                <table class="admin-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>image</th>
                            <th>title</th>
                            <th>brand</th>
                            <th>price</th>
                            <th>category</th>
                            <th>gender</th>
                            <th>sizes</th>
                            <th>popular</th>
                            <th>in_stock</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            list.forEach(p => {
                const img = p.image?.length
                    ? `<img src="http://127.0.0.1:8090/api/files/products/${p.id}/${p.image[0]}" class="avatar-img">`
                    : "";

                const sizesText =
                    p.category === "accessories"
                        ? "—"
                        : Array.isArray(p.sizes) ? p.sizes.join(", ") : "";

                html += `
                    <tr>
                        <td><input type="radio" name="selectedProduct" value="${p.id}"></td>
                        <td>${img}</td>
                        <td>${p.title}</td>
                        <td>${p.brand}</td>
                        <td>${p.price}</td>
                        <td>${p.category}</td>
                        <td>${p.gender}</td>
                        <td>${sizesText}</td>
                        <td>${p.popular ? "Да" : "Нет"}</td>
                        <td>${p.in_stock ? "Да" : "Нет"}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            this.tableHtml = html;

            setTimeout(() => {
                document.querySelectorAll("input[name='selectedProduct']").forEach(radio => {
                    radio.addEventListener("change", () => {
                        this.selectedProductId = radio.value;
                    });
                });
            }, 50);
        },

        
        filterProducts(query) {
            query = query.trim().toLowerCase();

            if (!query) {
                this.searchExact = false;
                this.renderProductsTable(this.products);
                return;
            }

            const filtered = this.products.filter(p => {
                const fields = [
                    p.title,
                    p.brand,
                    String(p.price),
                    p.category,
                    p.gender,
                    Array.isArray(p.sizes) ? p.sizes.join(", ") : "",
                    p.popular ? "да" : "нет",
                    p.in_stock ? "да" : "нет"
                ]
                .filter(Boolean)
                .map(f => f.toLowerCase());

                if (this.searchExact) {
                    
                    return fields.includes(query);
                } else {
                    
                    return fields.some(f => f.includes(query));
                }
            });

            this.renderProductsTable(filtered);

            if (this.searchExact) {
                this.searchExact = false;
            }
        },

        
        async loadProducts() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            this.products = await pb.collection("products").getFullList({
                sort: "-created"
            });

            this.tableLoaded = true;

            this.renderProductsTable(this.products);
        },

        validateProduct(prefix, isEdit = false) {
            this.clearModalError(prefix);

            const titleEl = document.querySelector(`#${prefix}_title`);
            const brandEl = document.querySelector(`#${prefix}_brand`);
            const priceEl = document.querySelector(`#${prefix}_price`);
            const categoryEl = document.querySelector(`#${prefix}_category`);
            const genderEl = document.querySelector(`#${prefix}_gender`);

            if (!titleEl || !brandEl || !priceEl || !categoryEl || !genderEl) {
                this.showModalError(prefix, "Внутренняя ошибка формы.");
                return false;
            }

            const title = titleEl.value.trim();
            const brand = brandEl.value.trim();
            const category = categoryEl.value.trim();
            const gender = genderEl.value.trim();
            let priceStr = priceEl.value.trim();

            let sizesLines = [];
            if (category !== "accessories") {
                const sizesEl = document.querySelector(`#${prefix}_sizes`);
                if (!sizesEl) {
                    this.showModalError(prefix, "Внутренняя ошибка размеров.");
                    return false;
                }
                sizesLines = sizesEl.value
                    .split("\n")
                    .map(s => s.trim())
                    .filter(Boolean);
            }

            if (!title || !brand || !priceStr || !category || !gender) {
                this.showModalError(prefix, "Заполните все обязательные поля.");
                return false;
            }

            if (!/^\d+$/.test(priceStr)) {
                this.showModalError(prefix, "Цена должна содержать только цифры.");
                return false;
            }

            let priceNum = parseInt(priceStr, 10);
            if (isNaN(priceNum) || priceNum <= 0) {
                this.showModalError(prefix, "Введите корректную цену.");
                return false;
            }

            if (priceNum > 200000) {
                priceNum = 200000;
                priceEl.value = "200000";
                this.showModalError(prefix, "Цена ограничена 200000.");
                return false;
            }

            if (category !== "accessories" && sizesLines.length === 0) {
                this.showModalError(prefix, "Укажите хотя бы один размер.");
                return false;
            }

            if (!isEdit) {
                const img1 = document.querySelector("#create_image").files;
                const img2 = document.querySelector("#create_image2").files[0];

                if ((!img1 || img1.length === 0) && !img2) {
                    this.showModalError(prefix, "Добавьте хотя бы одно изображение.");
                    return false;
                }
            }

            return {
                title,
                brand,
                price: priceNum,
                category,
                gender,
                sizesArray: sizesLines
            };
        },

        openCreate() {
            this.clearModalError("create");
            const sizesBlock = document.querySelector("#create_sizes_block");
            if (sizesBlock) sizesBlock.style.display = "block";
            document.querySelector("#createModal").showModal();
        },

        closeCreateModal() {
            document.querySelector("#createModal").close();
        },

        async createProduct() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            const validated = this.validateProduct("create", false);
            if (!validated) return;

            const form = new FormData();
            form.append("title", validated.title);
            form.append("brand", validated.brand);
            form.append("price", String(validated.price));
            form.append("category", validated.category);
            form.append("gender", validated.gender);
            form.append("popular", document.querySelector("#create_popular").checked);
            form.append("in_stock", document.querySelector("#create_in_stock").checked);

            if (validated.category !== "accessories") {
                form.append("sizes", JSON.stringify(validated.sizesArray));
            }

            const images = document.querySelector("#create_image").files;
            for (let file of images) {
                form.append("image", file);
            }

            const img2 = document.querySelector("#create_image2").files[0];
            if (img2) form.append("image2", img2);

            await pb.collection("products").create(form);

            this.closeCreateModal();
            this.loadProducts();
            this.showToast("Товар создан");
        },

        openEdit() {
            if (!this.selectedProductId) {
                this.showToast("Выберите товар");
                return;
            }

            const p = this.products.find(x => x.id === this.selectedProductId);
            if (!p) {
                this.showToast("Товар не найден");
                return;
            }

            this.clearModalError("edit");

            document.querySelector("#edit_id").value = p.id;
            document.querySelector("#edit_title").value = p.title ?? "";
            document.querySelector("#edit_brand").value = p.brand ?? "";
            document.querySelector("#edit_price").value = p.price ?? "";
            document.querySelector("#edit_category").value = p.category ?? "";
            document.querySelector("#edit_gender").value = p.gender ?? "";
            document.querySelector("#edit_popular").checked = !!p.popular;
            document.querySelector("#edit_in_stock").checked = !!p.in_stock;

            const sizesBlock = document.querySelector("#edit_sizes_block");
            const sizesEl = document.querySelector("#edit_sizes");

            if (p.category === "accessories") {
                if (sizesBlock) sizesBlock.style.display = "none";
                if (sizesEl) sizesEl.value = "";
            } else {
                if (sizesBlock) sizesBlock.style.display = "block";
                if (sizesEl) {
                    sizesEl.value = Array.isArray(p.sizes) ? p.sizes.join("\n") : "";
                }
            }

            document.querySelector("#editModal").showModal();
        },

        closeEditModal() {
            document.querySelector("#editModal").close();
        },

        async updateProduct() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            const id = document.querySelector("#edit_id").value;
            if (!id) {
                this.showModalError("edit", "Внутренняя ошибка: нет ID товара.");
                return;
            }

            const validated = this.validateProduct("edit", true);
            if (!validated) return;

            const form = new FormData();
            form.append("title", validated.title);
            form.append("brand", validated.brand);
            form.append("price", String(validated.price));
            form.append("category", validated.category);
            form.append("gender", validated.gender);
            form.append("popular", document.querySelector("#edit_popular").checked);
            form.append("in_stock", document.querySelector("#edit_in_stock").checked);

            if (validated.category !== "accessories") {
                form.append("sizes", JSON.stringify(validated.sizesArray));
            } else {
                form.append("sizes", JSON.stringify([]));
            }

            const images = document.querySelector("#edit_image").files;
            for (let file of images) {
                form.append("image", file);
            }

            const img2 = document.querySelector("#edit_image2").files[0];
            if (img2) form.append("image2", img2);

            await pb.collection("products").update(id, form);

            this.closeEditModal();
            this.loadProducts();
            this.showToast("Товар обновлён");
        },

        askDelete() {
            if (!this.selectedProductId) {
                this.showToast("Выберите товар");
                return;
            }

            this.pendingDeleteId = this.selectedProductId;
            document.querySelector("#confirmDelete").style.display = "flex";
        },

        cancelDelete() {
            this.pendingDeleteId = null;
            document.querySelector("#confirmDelete").style.display = "none";
        },

        async confirmDelete() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!this.pendingDeleteId) {
                this.showToast("Нет выбранного товара для удаления");
                return;
            }

            await pb.collection("products").delete(this.pendingDeleteId);

            this.pendingDeleteId = null;
            document.querySelector("#confirmDelete").style.display = "none";

            this.loadProducts();
            this.showToast("Товар удалён");
        },

        logout() {
            const pb = new PocketBase("http://127.0.0.1:8090");
            pb.authStore.clear();
            window.location.href = "index.html";
        }
    };

    return self;
}
