window.profilePage = function () {
    return {
        tab: 'info',
        email: "",
        first_name: "",
        last_name: "",
        phone: "",
        address: "",
        birthdate: "",
        postal_code: "",
        avatar: "",
        orders: [],

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

    async init() {
        const pb = new PocketBase('http://127.0.0.1:8090');

        if (!pb.authStore.isValid) {
            window.location.href = "login.html";
            return;
        }

        let user;
        try {
            user = await pb.collection("users").getOne(pb.authStore.model.id);
        } catch (err) {
            console.error("Ошибка загрузки пользователя:", err);
            user = pb.authStore.model;
        }

        this.email = user.email;
        this.first_name = user.first_name || "";
        this.last_name = user.last_name || "";
        this.phone = user.phone || "";
        this.address = user.address || "";
        this.birthdate = user.birthdate ? user.birthdate.split(" ")[0] : "";
        this.postal_code = user.postal_code || "";

        this.avatar = user.avatar
        ? `http://127.0.0.1:8090/api/files/users/${user.id}/${user.avatar}`
        : "../img/people.jpg";

        await this.loadOrders();

    //  Если в URL есть #orders → сразу открываем вкладку заказов
        if (window.location.hash === "#orders") {
            this.tab = "orders";
        }

    // автообновление статусов
        setInterval(() => {
            this.loadOrders();
        }, 30000);

        this.initGlobalSearch();
    },


        // форматирование даты доставки для вывода
        formatDelivery(dateStr) {
            if (!dateStr) return "";
            const date = new Date(dateStr);
            const options = { day: "numeric", month: "short" };
            return date.toLocaleDateString("ru-RU", options);
        },

        // Алгоритм смены статусов
        updateOrderStatus(order) {
            const now = new Date();

            // 1) Если прошло меньше минуты → статус "Создан"
            if (order.created_at) {
                const created = new Date(order.created_at);
                const diffMs = now - created;
                const diffMinutes = diffMs / 1000 / 60;

                if (diffMinutes < 1) {
                    return "Создан";
                }
            }

            // 2) Если дата доставки в будущем → "В пути"
            if (order.delivery_date) {
                const delivery = new Date(order.delivery_date);

                if (now < delivery) {
                    return "В пути";
                }

                // 3) Если сегодня или позже → "Доставлен"
                if (now >= delivery) {
                    return "Доставлен";
                }
            }

            return order.status;
        },

        async loadOrders() {
            const pb = new PocketBase('http://127.0.0.1:8090');

            try {
                const list = await pb.collection("orders").getFullList({
                    filter: `user = "${pb.authStore.model.id}"`,
                    sort: "-created"
                });

                this.orders = list.map(order => {
                    const newStatus = this.updateOrderStatus(order);

                    if (newStatus !== order.status) {
                        pb.collection("orders").update(order.id, { status: newStatus });
                        order.status = newStatus;
                    }

                    return order;
                });

            } catch (err) {
                console.error("Ошибка загрузки заказов:", err);
            }
        },

        initGlobalSearch() {
            setTimeout(() => {
                const input = document.getElementById("globalSearchInput");
                if (!input) return;

                input.addEventListener("keyup", (e) => {
                    if (e.key === "Enter") {
                        const q = input.value.trim();
                        if (q !== "") {
                            window.location.href = `catalog.html?search=${encodeURIComponent(q)}`;
                        } else {
                            window.location.href = `catalog.html`;
                        }
                    }
                });
            }, 200);
        },

        async saveInfo() {
            const pb = new PocketBase('http://127.0.0.1:8090');

            if (this.phone.trim() !== "") {
                let digits = this.phone.replace(/\D/g, "");

                if (digits.startsWith("8")) {
                    digits = digits.substring(1);
                }

                if (digits.length > 10) {
                    digits = digits.substring(0, 10);
                }

                if (digits.length < 10) {
                    this.showToast("Введите корректный номер телефона или оставьте поле пустым");
                    return;
                }

                const formatted =
                    "8-" +
                    digits.substring(0, 3) + "-" +
                    digits.substring(3, 6) + "-" +
                    digits.substring(6, 8) + "-" +
                    digits.substring(8, 10);

                this.phone = formatted;
            } else {
                this.phone = "";
            }

            let pc = this.postal_code.replace(/\D/g, "");

            if (pc.length > 6) pc = pc.substring(0, 6);

            if (pc.length > 0 && pc.length < 6) {
                this.showToast("Почтовый индекс должен содержать 6 цифр");
                return;
            }

            this.postal_code = pc;

            const formData = new FormData();
            formData.append("first_name", this.first_name);
            formData.append("last_name", this.last_name);
            formData.append("phone", this.phone);
            formData.append("address", this.address);
            formData.append("birthdate", this.birthdate);
            formData.append("postal_code", this.postal_code);

            const fileInput = document.getElementById("avatar-input");
            if (fileInput.files.length > 0) {
                formData.append("avatar", fileInput.files[0]);
            }

            await pb.collection("users").update(pb.authStore.model.id, formData);

            this.showToast("Данные успешно сохранены");
        },

        logout() {
            const pb = new PocketBase('http://127.0.0.1:8090');
            pb.authStore.clear();

            localStorage.removeItem("cart");
            window.dispatchEvent(new Event('cart-updated'));

            window.location.href = "index.html";
        }
    }
}
