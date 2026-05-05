function checkoutPage() {
    return {
        items: [],
        loading: true,

        first_name: "",
        address: "",
        postal_code: "",
        phone: "",
        payment: "",
        editingAddress: false,
        deliveryCost: 0,

        postalError: "",
        phoneError: "",

        showToast(message) {
            const container = document.getElementById("toast-container");
            if (!container) return;

            const toast = document.createElement("div");
            toast.className = "toast";
            toast.textContent = message;

            container.appendChild(toast);

            setTimeout(() => {
                toast.remove();
            }, 3000);
        },

        showCenteredToast(message) {
            const container = document.getElementById("toast-container");
            if (!container) return;

            const toast = document.createElement("div");
            toast.className = "toast toast-center";
            toast.textContent = message;

            container.appendChild(toast);

            setTimeout(() => toast.classList.add("show"), 10);

            setTimeout(() => {
                toast.classList.remove("show");
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        },

        async init() {
            this.items = JSON.parse(localStorage.getItem("checkoutItems") || "[]");

            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) {
                this.loading = false;
                this.showToast("Войдите в аккаунт для оформления заказа");
                window.location.href = "login.html";
                return;
            }

            try {
                const user = await pb.collection("users").getOne(pb.authStore.model.id);

                this.first_name = (user.first_name || "").toString();
                this.address = (user.address || "").toString();
                this.postal_code = (user.postal_code || "").toString();
                this.phone = (user.phone || "").toString();

            } catch (err) {
                console.error("Ошибка загрузки пользователя:", err);
            }

            if (!this.first_name || !this.address || !this.postal_code || !this.phone) {
                this.editingAddress = true;
            }

            this.updateDelivery();

            this.loading = false;

            this.initGlobalSearch();

            this.$watch("postal_code", () => this.validatePostal());
            this.$watch("phone", () => this.validatePhone());
        },

        updateDelivery() {
            const total = this.totalPrice();
            this.deliveryCost = total < 15000 ? 1500 : 0;
        },

        validatePostal() {
            this.postal_code = (this.postal_code || "").toString().replace(/\D/g, "");

            if (this.postal_code.length > 6) {
                this.postal_code = this.postal_code.slice(0, 6);
            }

            if (this.postal_code.length < 6) {
                this.postalError = "Индекс должен содержать 6 цифр";
            } else {
                this.postalError = "";
            }
        },

        validatePhone() {
            this.phone = (this.phone || "").toString().replace(/\D/g, "");

            if (this.phone.length === 0) {
                this.phone = "8";
            }

            if (this.phone[0] !== "8") {
                this.phone = "8" + this.phone.slice(1);
            }

            if (this.phone.length > 11) {
                this.phone = this.phone.slice(0, 11);
            }

            if (this.phone.length < 11) {
                this.phoneError = "Номер должен содержать 11 цифр";
            } else {
                this.phoneError = "";
            }

            this.phone = this.formatPhone(this.phone);
        },

        formatPhone(num) {
            const digits = num.replace(/\D/g, "");

            let result = "8";

            if (digits.length > 1) result += "-" + digits.slice(1, 4);
            if (digits.length > 4) result += "-" + digits.slice(4, 7);
            if (digits.length > 7) result += "-" + digits.slice(7, 9);
            if (digits.length > 9) result += "-" + digits.slice(9, 11);

            return result;
        },

        formatPrice(value) {
            if (!value) return "0";
            return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        },

        totalItems() {
            return this.items.reduce((sum, item) => sum + (item.quantity || 1), 0);
        },

        totalPrice() {
            return this.items.reduce((sum, item) => sum + (item.price * (item.quantity || 1)), 0);
        },

        totalWithDelivery() {
            return this.totalPrice() + (this.deliveryCost || 0);
        },

        hasDeliveryProblems() {
            return (
                (this.first_name || "").toString().trim() === "" ||
                (this.address || "").toString().trim() === "" ||
                (this.postal_code || "").toString().trim() === "" ||
                (this.phone || "").toString().trim() === "" ||
                this.postalError !== "" ||
                this.phoneError !== ""
            );
        },

        hasPaymentProblem() {
            return this.payment === "";
        },

        warningMessage() {
            const deliveryBad = this.hasDeliveryProblems();
            const paymentBad = this.hasPaymentProblem();

            if (deliveryBad && paymentBad) {
                return "Убедитесь, что заполнены имя, адрес, индекс, телефон и выбран способ оплаты.";
            }

            if (deliveryBad) {
                return "Убедитесь, что заполнены имя, адрес, индекс, телефон.";
            }

            if (paymentBad) {
                return "Убедитесь, что выбран способ оплаты.";
            }

            return "";
        },

        canOrder() {
            return (
                this.items.length > 0 &&
                !this.hasDeliveryProblems() &&
                !this.hasPaymentProblem()
            );
        },

        async clearFullCart() {
            const pb = new PocketBase("http://127.0.0.1:8090");

            if (!pb.authStore.isValid) {
                localStorage.removeItem("cart");
                window.dispatchEvent(new Event("cart-updated"));
                return;
            }

            const userId = pb.authStore.model.id;

            try {
                const records = await pb.collection("cart").getFullList({
                    filter: `user = "${userId}"`
                });

                for (const rec of records) {
                    await pb.collection("cart").delete(rec.id);
                }
            } catch (err) {
                console.error("Ошибка очистки корзины PB:", err);
            }

            localStorage.removeItem("cart");
            window.dispatchEvent(new Event("cart-updated"));
        },

        async placeOrder() {
            if (!this.canOrder()) return;

            const pb = new PocketBase("http://127.0.0.1:8090");

            let lastOrderNumber = 0;

            try {
                const list = await pb.collection("orders").getList(1, 1, {
                    sort: "-order_number"
                });

                if (list.items.length > 0) {
                    lastOrderNumber = list.items[0].order_number;
                }
            } catch (err) {
                console.error("Ошибка получения последнего номера заказа:", err);
            }

            const newOrderNumber = lastOrderNumber + 1;

            const orderData = {
                user: pb.authStore.model.id,
                items: this.items,
                total_price: this.totalWithDelivery(),
                order_number: newOrderNumber,
                status: "Создан",
                delivery_date: this.getRandomDeliveryDate() 
                
            };

            try {
                await pb.collection("orders").create(orderData);

                this.showCenteredToast("Заказ успешно оформлен");

                await this.clearFullCart();

                localStorage.removeItem("checkoutItems");

                setTimeout(() => {
                    window.location.href = "orders.html?order=" + newOrderNumber;
                }, 1000);

            } catch (err) {
                console.error("Ошибка оформления заказа:", err);
                this.showToast("Ошибка оформления заказа");
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
        },

        getDeliveryDates() {
            const today = new Date();

            const start = new Date(today);
            start.setDate(today.getDate() + 7);

            const end = new Date(today);
            end.setDate(today.getDate() + 11);

            const options = { day: "numeric", month: "short" };

            const startStr = start.toLocaleDateString("ru-RU", options);
            const endStr = end.toLocaleDateString("ru-RU", options);

            return `${startStr} — ${endStr}`;
        },

        getRandomDeliveryDate() {
            const today = new Date();
            const offset = Math.floor(Math.random() * (11 - 7 + 1)) + 7;

            const deliveryDate = new Date(today);
            deliveryDate.setDate(today.getDate() + offset);

            return deliveryDate.toISOString(); 
        }
    };
}
