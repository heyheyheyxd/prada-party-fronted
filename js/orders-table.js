// Частичный поиск
window.ordersSearchHandler = function (query) {
    if (window.ordersPanelInstance && window.ordersPanelInstance.filterOrders) {
        window.ordersPanelInstance.searchExact = false;
        window.ordersPanelInstance.filterOrders(query);
    }
};

// Точный поиск по Enter
window.ordersSearchEnter = function (e) {
    if (e.key === "Enter") {
        if (window.ordersPanelInstance) {
            window.ordersPanelInstance.searchExact = true;
            window.ordersPanelInstance.filterOrders(e.target.value);
        }
    }
};

function ordersPanel() {
    return {
        tableHtml: "",
        tableLoaded: false,
        orders: [],
        selectedOrderId: null,
        pendingDeleteId: null,

        searchExact: false,

        productsMeta: [],
        brandsList: [],

        init() {
            window.ordersPanelInstance = this;
        },

        async getNextOrderNumber() {
            const pb = new PocketBase("https://prada-party.onrender.com");
            
            try {
                
                const result = await pb.collection("orders").getList(1, 1, {
                    sort: "-order_number"
                });
                
                if (result.items && result.items.length > 0) {
                    const maxNumber = result.items[0].order_number;
                    return String(Number(maxNumber) + 1);
                }
                
                
                return "1";
            } catch (err) {
                console.error("Error fetching max order number:", err);
                return "1";
            }
        },

        showToast(message) {
            const container = document.getElementById("toast-container");
            if (!container) return;
            const toast = document.createElement("div");
            toast.className = "toast";
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },

        async checkAdmin() {
            const pb = new PocketBase("https://prada-party.onrender.com");

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

            this.init();
            await this.loadProductsMeta();
            await this.loadOrders();

            setInterval(() => this.loadOrders(), 60000);
        },

        async loadProductsMeta() {
            const pb = new PocketBase("https://prada-party.onrender.com");
            this.productsMeta = await pb.collection("products").getFullList();
            this.brandsList = [...new Set(this.productsMeta.map(p => p.brand).filter(Boolean))];
        },

        async loadOrders() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            this.orders = await pb.collection("orders").getFullList({
                sort: "-created",
                expand: "user"
            });

            // обновление статуса
            this.orders = this.orders.map(order => {
                const newStatus = this.updateOrderStatus(order);
                if (newStatus !== order.status) {
                    pb.collection("orders").update(order.id, { status: newStatus });
                    order.status = newStatus;
                }
                return order;
            });

            this.tableLoaded = true;
            this.renderOrdersTable(this.orders);
        },

        updateOrderStatus(order) {
            const now = new Date();

            if (order.created_at) {
                const created = new Date(order.created_at);
                if ((now - created) / 60000 < 1) return "Создан";
            }

            if (order.delivery_date) {
                const delivery = new Date(order.delivery_date);
                if (now < delivery) return "В пути";
                if (now >= delivery) return "Доставлен";
            }

            return order.status;
        },

        getProductByBrandTitle(brand, title) {
            return this.productsMeta.find(p => p.brand === brand && p.title === title) || null;
        },

        getTitlesByBrand(brand) {
            return [
                ...new Set(
                    this.productsMeta
                        .filter(p => p.brand === brand)
                        .map(p => p.title)
                        .filter(Boolean)
                )
            ];
        },

        getSizesByBrandTitle(brand, title) {
            const found = this.getProductByBrandTitle(brand, title);
            if (!found) return [];
            if (Array.isArray(found.sizes)) return found.sizes;
            return [];
        },

        hasSizes(brand, title) {
            const p = this.getProductByBrandTitle(brand, title);
            return Array.isArray(p?.sizes) && p.sizes.length > 0;
        },

        

        formatItems(items) {
            if (!Array.isArray(items)) return "";

            return items
                .map(i => {
                    const q = i.quantity ?? 1;
                    const price = i.price != null ? ` — ${i.price} ₽` : "";

                    if (!i.size) {
                        return `${i.brand} — ${i.title} ×${q}${price}`;
                    }

                    return `${i.brand} — ${i.title} (${i.size}) ×${q}${price}`;
                })
                .join("<br>");
        },

        formatDate(dateStr) {
            if (!dateStr) return "—";
            if (dateStr.includes("T")) return dateStr.split("T")[0];
            return dateStr;
        },

        // TABLE

        renderOrdersTable(list) {
            let html = `
                <h2>Заказы</h2>

                <table class="admin-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>Пользователь</th>
                            <th>Товары</th>
                            <th>Сумма</th>
                            <th>Номер заказа</th>
                            <th>Статус</th>
                            <th>Дата доставки</th>
                            <th>Создан</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            list.forEach(o => {
                const u = o.expand?.user;
                const userText = u ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() : "—";

                html += `
                    <tr>
                        <td><input type="radio" name="selectedOrder" value="${o.id}"></td>
                        <td>${userText}</td>
                        <td>${this.formatItems(o.items)}</td>
                        <td>${o.total_price}</td>
                        <td>${o.order_number}</td>
                        <td>${o.status ?? ""}</td>
                        <td>${this.formatDate(o.delivery_date)}</td>
                        <td>${this.formatDate(o.created_at ?? o.created)}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            this.tableHtml = html;

            setTimeout(() => this.initSelection(), 50);
        },

        initSelection() {
            document.querySelectorAll("input[name='selectedOrder']").forEach(radio => {
                radio.addEventListener("change", () => {
                    this.selectedOrderId = radio.value;
                });
            });
        },

        // SEARCH

        filterOrders(query) {
            query = query.trim().toLowerCase();

            if (!query) {
                this.searchExact = false;
                this.renderOrdersTable(this.orders);
                return;
            }

            const filtered = this.orders.filter(o => {
                const u = o.expand?.user;

                const userText = u
                    ? `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim().toLowerCase()
                    : "";

                const itemsText = this.formatItems(o.items)
                    .replace(/<br>/g, " ")
                    .toLowerCase();

                const fields = [
                    userText,
                    itemsText,
                    String(o.total_price),
                    String(o.order_number),
                    String(o.status ?? ""),
                    String(this.formatDate(o.delivery_date)),
                    String(this.formatDate(o.created_at ?? o.created))
                ]
                    .filter(Boolean)
                    .map(f => f.toLowerCase());

                if (this.searchExact) {
                    return fields.includes(query);
                } else {
                    return fields.some(f => f.includes(query));
                }
            });

            this.renderOrdersTable(filtered);

            if (this.searchExact) {
                this.searchExact = false;
            }
        },

        

        createItemRowElement(prefix, item = null) {
            const container = document.createElement("div");
            container.className = "order-item-row";

            const brandsOptions = this.brandsList
                .map(b => `<option value="${b}">${b}</option>`)
                .join("");

            const brandValue = item?.brand || this.brandsList[0] || "";
            const titles = this.getTitlesByBrand(brandValue);
            const titleValue = item?.title || titles[0] || "";

            const sizes = this.getSizesByBrandTitle(brandValue, titleValue);
            const sizeValue = item?.size || sizes[0] || "";

            const quantityValue = item?.quantity ?? 1;

            container.innerHTML = `
                <div class="order-item-row-inner">
                    <div class="order-item-field">
                        <label>Бренд*</label>
                        <select class="${prefix}_brand">${brandsOptions}</select>
                    </div>

                    <div class="order-item-field">
                        <label>Название*</label>
                        <select class="${prefix}_title"></select>
                    </div>

                    <div class="order-item-field size-field" style="display:none;">
                        <label>Размер*</label>
                        <select class="${prefix}_size"></select>
                    </div>

                    <div class="order-item-field">
                        <label>Кол-во*</label>
                        <input type="number" class="${prefix}_quantity" min="1" value="${quantityValue}">
                    </div>

                    <div class="order-item-field">
                        <label>Цена (₽)</label>
                        <span class="${prefix}_price_text">—</span>
                    </div>

                    <button type="button" class="small-btn remove-item">Удалить</button>
                </div>
            `;

            const brandSelect = container.querySelector(`.${prefix}_brand`);
            const titleSelect = container.querySelector(`.${prefix}_title`);
            const sizeSelect = container.querySelector(`.${prefix}_size`);
            const sizeField = container.querySelector(".size-field");
            const quantityInput = container.querySelector(`.${prefix}_quantity`);
            const priceSpan = container.querySelector(`.${prefix}_price_text`);
            const removeBtn = container.querySelector(".remove-item");

            brandSelect.value = brandValue;

            const updateSizeVisibility = () => {
                const b = brandSelect.value;
                const t = titleSelect.value;

                if (this.hasSizes(b, t)) {
                    sizeField.style.display = "block";
                } else {
                    sizeField.style.display = "none";
                    sizeSelect.innerHTML = "";
                }
            };

            const fillTitles = () => {
                const b = brandSelect.value;
                const titlesLocal = this.getTitlesByBrand(b);

                titleSelect.innerHTML = titlesLocal
                    .map(t => `<option value="${t}">${t}</option>`)
                    .join("");

                if (item?.title) titleSelect.value = item.title;

                fillSizes();
            };

            const fillSizes = () => {
                const b = brandSelect.value;
                const t = titleSelect.value;
                const sizesLocal = this.getSizesByBrandTitle(b, t);

                if (sizesLocal.length > 0) {
                    sizeSelect.innerHTML = sizesLocal
                        .map(s => `<option value="${s}">${s}</option>`)
                        .join("");

                    if (item?.size) sizeSelect.value = item.size;
                } else {
                    sizeSelect.innerHTML = "";
                }

                updateSizeVisibility();
                updatePrice();
            };

            const updatePrice = () => {
                const b = brandSelect.value;
                const t = titleSelect.value;
                const product = this.getProductByBrandTitle(b, t);
                const price = product?.price ?? null;

                priceSpan.textContent = price != null ? `${price} ₽` : "—";
                this.recalcTotal(prefix);
            };

            brandSelect.addEventListener("change", fillTitles);
            titleSelect.addEventListener("change", fillSizes);
            sizeSelect.addEventListener("change", () => this.recalcTotal(prefix));
            quantityInput.addEventListener("input", () => this.recalcTotal(prefix));

            removeBtn.addEventListener("click", () => {
                container.remove();
                this.recalcTotal(prefix);
            });

            fillTitles();
            return container;
        },

        addCreateItemRow(item = null) {
            const block = document.querySelector("#create_items_block");
            if (!block) return;

            if (!this.brandsList.length) {
                this.showToast("Нет товаров в базе");
                return;
            }

            const row = this.createItemRowElement("create", item);
            block.appendChild(row);
            this.recalcTotal("create");
        },

        addEditItemRow(item = null) {
            const block = document.querySelector("#edit_items_block");
            if (!block) return;

            if (!this.brandsList.length) {
                this.showToast("Нет товаров в базе");
                return;
            }

            const row = this.createItemRowElement("edit", item);
            block.appendChild(row);
            this.recalcTotal("edit");
        },

        recalcTotal(prefix) {
            const block = document.querySelector(prefix === "create" ? "#create_items_block" : "#edit_items_block");
            const totalInput = document.querySelector(prefix === "create" ? "#create_total_price" : "#edit_total_price");

            if (!block || !totalInput) return;

            let total = 0;

            block.querySelectorAll(".order-item-row").forEach(row => {
                const brand = row.querySelector(`.${prefix}_brand`)?.value?.trim();
                const title = row.querySelector(`.${prefix}_title`)?.value?.trim();
                const quantity = parseInt(row.querySelector(`.${prefix}_quantity`)?.value) || 0;

                if (!brand || !title || quantity <= 0) return;

                const product = this.getProductByBrandTitle(brand, title);
                const price = product?.price ?? 0;

                total += price * quantity;
            });

            totalInput.value = total;
        },

        collectItemsFromBlock(prefix) {
            const block = document.querySelector(prefix === "create" ? "#create_items_block" : "#edit_items_block");
            if (!block) return [];

            const items = [];

            for (const row of block.querySelectorAll(".order-item-row")) {
                const brand = row.querySelector(`.${prefix}_brand`)?.value?.trim();
                const title = row.querySelector(`.${prefix}_title`)?.value?.trim();
                const size = row.querySelector(`.${prefix}_size`)?.value?.trim();
                const quantity = parseInt(row.querySelector(`.${prefix}_quantity`)?.value);

                const hasSize = this.hasSizes(brand, title);

                if (!brand || !title || (!size && hasSize) || !quantity || quantity <= 0) {
                    this.showToast("Заполните все поля товара");
                    return null;
                }

                const product = this.getProductByBrandTitle(brand, title);
                const price = product?.price ?? 0;

                let image = null;
                if (product?.image?.length) {
                    image = `https://prada-party.onrender.com/api/files/products/${product.id}/${product.image[0]}`;
                }

                const itemObj = { brand, title, quantity, price, image };
                if (hasSize) itemObj.size = size;

                items.push(itemObj);
            }

            if (items.length === 0) {
                this.showToast("Добавьте хотя бы один товар");
                return null;
            }

            return items;
        },

        // CREATE

        async openCreate() {
            const number = await this.getNextOrderNumber();
            
            document.querySelector("#create_error").style.display = "none";
            document.querySelector("#create_items_block").innerHTML = "";
            document.querySelector("#create_total_price").value = "";
            document.querySelector("#create_order_number").value = number;
            document.querySelector("#create_order_number").readOnly = true;

            if (this.brandsList.length) this.addCreateItemRow();

            document.querySelector("#createModal").showModal();
        },

        closeCreateModal() {
            document.querySelector("#createModal").close();
        },

        async createOrder() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            const user = document.querySelector("#create_user").value.trim();
            const total = document.querySelector("#create_total_price").value.trim();
            const number = document.querySelector("#create_order_number").value.trim();
            const status = document.querySelector("#create_status").value.trim();
            const delivery = document.querySelector("#create_delivery_date").value.trim();

            if (!user || !total || !number || !status || !delivery) {
                this.showToast("Заполните все обязательные поля");
                return;
            }

            const items = this.collectItemsFromBlock("create");
            if (!items) return;

            await pb.collection("orders").create({
                user,
                items,
                total_price: Number(total),
                order_number: number,
                status,
                delivery_date: delivery
            });

            this.closeCreateModal();
            await this.loadOrders();
            this.showToast("Заказ создан");
        },

        // EDIT

        openEdit() {
            if (!this.selectedOrderId) {
                this.showToast("Выберите заказ");
                return;
            }

            const o = this.orders.find(x => x.id === this.selectedOrderId);
            if (!o) {
                this.showToast("Заказ не найден");
                return;
            }

            document.querySelector("#edit_id").value = o.id;
            document.querySelector("#edit_user").value = o.user ?? "";
            document.querySelector("#edit_total_price").value = o.total_price ?? "";
            document.querySelector("#edit_order_number").value = o.order_number ?? "";
            document.querySelector("#edit_order_number").readOnly = true;
            document.querySelector("#edit_status").value = o.status ?? "";
            document.querySelector("#edit_delivery_date").value = this.formatDate(o.delivery_date);

            const block = document.querySelector("#edit_items_block");
            block.innerHTML = "";

            if (Array.isArray(o.items) && o.items.length) {
                o.items.forEach(it => this.addEditItemRow(it));
            } else {
                this.addEditItemRow();
            }

            document.querySelector("#edit_error").style.display = "none";

            this.recalcTotal("edit");
            document.querySelector("#editModal").showModal();
        },

        closeEditModal() {
            document.querySelector("#editModal").close();
        },

        async updateOrder() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            const id = document.querySelector("#edit_id").value;
            const user = document.querySelector("#edit_user").value.trim();
            const total = document.querySelector("#edit_total_price").value.trim();
            const number = document.querySelector("#edit_order_number").value.trim();
            const status = document.querySelector("#edit_status").value.trim();
            const delivery = document.querySelector("#edit_delivery_date").value.trim();

            if (!id || !user || !total || !number || !status || !delivery) {
                this.showToast("Заполните все обязательные поля");
                return;
            }

            const items = this.collectItemsFromBlock("edit");
            if (!items) return;

            await pb.collection("orders").update(id, {
                user,
                items,
                total_price: Number(total),
                order_number: number,
                status,
                delivery_date: delivery
            });

            this.closeEditModal();
            await this.loadOrders();
            this.showToast("Заказ обновлён");
        },

        // DELETE

        askDelete() {
            if (!this.selectedOrderId) {
                this.showToast("Выберите заказ");
                return;
            }

            this.pendingDeleteId = this.selectedOrderId;
            document.querySelector("#confirmDelete").style.display = "flex";
        },

        cancelDelete() {
            this.pendingDeleteId = null;
            document.querySelector("#confirmDelete").style.display = "none";
        },

        async confirmDelete() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            if (!this.pendingDeleteId) {
                this.showToast("Нет выбранного заказа для удаления");
                return;
            }

            await pb.collection("orders").delete(this.pendingDeleteId);

            this.pendingDeleteId = null;
            document.querySelector("#confirmDelete").style.display = "none";

            await this.loadOrders();
            this.showToast("Заказ удалён");
        },

        logout() {
            const pb = new PocketBase("https://prada-party.onrender.com");
            pb.authStore.clear();
            window.location.href = "index.html";
        }
    };
}

