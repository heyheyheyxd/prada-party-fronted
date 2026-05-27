// Частичный поиск при вводе
window.adminSearchHandler = function (query) {
    if (window.__adminInstance && window.__adminInstance.filterUsers) {
        window.__adminInstance.searchExact = false;
        window.__adminInstance.filterUsers(query);
    }
};

// Точный поиск при Enter
window.adminSearchEnter = function (e) {
    if (e.key === "Enter") {
        if (window.__adminInstance) {
            window.__adminInstance.searchExact = true;
            window.__adminInstance.filterUsers(e.target.value);
        }
    }
};

function adminPanel() {
    return {
        tableHtml: "",
        tableLoaded: false,
        is_admin: false,
        users: [],
        selectedUserId: null,
        pendingDeleteId: null,

        searchExact: false,

        init() {
            window.__adminInstance = this;
        },


        showModalError(prefix, message) {
            const box = document.querySelector(`#${prefix}_error`);
            if (!box) return;
            box.textContent = message;
            box.style.display = "block";

            box.classList.remove("shake");
            void box.offsetWidth;
            box.classList.add("shake");
        },

        clearModalError(prefix) {
            const box = document.querySelector(`#${prefix}_error`);
            if (!box) return;
            box.style.display = "none";
            box.textContent = "";
        },

        showToast(message) {
            const container = document.getElementById("toast-container");
            const toast = document.createElement("div");
            toast.className = "toast";
            toast.textContent = message;
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 3000);
        },


        formatPhone(prefix) {
            const el = document.querySelector(`#${prefix}_phone`);
            if (!el) return;
            let digits = String(el.value || "").replace(/\D/g, "");

            
            if (digits.startsWith("8")) digits = digits.substring(1);

            
            if (digits.length > 10) digits = digits.substring(0, 10);

            
            if (digits.length === 10) {
                el.value =
                    "8-" +
                    digits.substring(0, 3) + "-" +
                    digits.substring(3, 6) + "-" +
                    digits.substring(6, 8) + "-" +
                    digits.substring(8, 10);
            } else {
                el.value = digits ? "8-" + digits : "";
            }
        },

        formatPostal(prefix) {
            const el = document.querySelector(`#${prefix}_postal_code`);
            if (!el) return;
            let digits = String(el.value || "").replace(/\D/g, "");
            if (digits.length > 6) digits = digits.substring(0, 6);
            el.value = digits;
        },


        validateUser(prefix, isEdit = false) {
            this.clearModalError(prefix);

            const email = document.querySelector(`#${prefix}_email`)?.value.trim();
            const password = document.querySelector(`#${prefix}_password`)?.value.trim();


            if (!isEdit) {
                if (!email) {
                    this.showModalError(prefix, "Введите email");
                    return false;
                }
                if (!/^\S+@\S+\.\S+$/.test(email)) {
                    this.showModalError(prefix, "Некорректный email");
                    return false;
                }
                if (!password) {
                    this.showModalError(prefix, "Введите пароль");
                    return false;
                }

                if (password.length < 8) {
                    this.showModalError(prefix, "Пароль должен быть минимум 8 символов");
                    return false;
                }
            }

            const postal = document.querySelector(`#${prefix}_postal_code`)?.value.trim();
            if (postal) {
                if (!/^\d{6}$/.test(postal)) {
                    this.showModalError(prefix, "Почтовый индекс должен содержать 6 цифр");
                    return false;
                }
            }

            
            const phoneEl = document.querySelector(`#${prefix}_phone`);
            const phoneVal = (phoneEl?.value || "").replace(/\D/g, "");

            if (phoneVal.length > 0 && phoneVal.length < 10) {
                this.showModalError(prefix, "Введите корректный номер телефона или оставьте поле пустым");
                return false;
            }

            return true;
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

            this.is_admin = true;
            this.init();
            this.loadUsersTable();
        },



        openCreate() {
            this.clearModalError("create");
            document.querySelector("#createModal").showModal();
        },

        openEdit() {
            if (!this.selectedUserId) {
                this.showToast("Выберите пользователя");
                return;
            }

            const user = this.users.find(u => u.id === this.selectedUserId);

            this.clearModalError("edit");

            document.querySelector("#edit_id").value = user.id;
            document.querySelector("#edit_first_name").value = user.first_name ?? "";
            document.querySelector("#edit_last_name").value = user.last_name ?? "";
            document.querySelector("#edit_phone").value = user.phone ?? "";
            document.querySelector("#edit_address").value = user.address ?? "";
            document.querySelector("#edit_postal_code").value = user.postal_code ?? "";
            document.querySelector("#edit_birthdate").value = user.birthdate ? user.birthdate.split(" ")[0] : "";
            document.querySelector("#edit_is_admin").checked = user.is_admin;

            document.querySelector("#editModal").showModal();
        },

        closeCreateModal() {
            document.querySelector("#createModal").close();
        },

        closeEditModal() {
            document.querySelector("#editModal").close();
        },


        askDelete() {
            if (!this.selectedUserId) {
                this.showToast("Выберите пользователя");
                return;
            }

            this.pendingDeleteId = this.selectedUserId;
            document.querySelector("#confirmDelete").style.display = "flex";
        },

        cancelDelete() {
            this.pendingDeleteId = null;
            document.querySelector("#confirmDelete").style.display = "none";
        },

        async confirmDelete() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            await pb.collection("users").delete(this.pendingDeleteId);

            this.pendingDeleteId = null;
            document.querySelector("#confirmDelete").style.display = "none";

            this.loadUsersTable();
            this.showToast("Запись удалена");
        },


        async loadUsersTable() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            this.users = await pb.collection("users").getFullList({
                sort: "-created"
            });

            this.tableLoaded = true;

            this.renderUsersTable(this.users);
        },

        renderUsersTable(list) {
            let html = `
                <h2>Пользователи</h2>

                <table class="admin-table">
                    <thead>
                        <tr>
                            <th></th>
                            <th>avatar</th>
                            <th>first_name</th>
                            <th>last_name</th>
                            <th>phone</th>
                            <th>address</th>
                            <th>postal_code</th>
                            <th>birthdate</th>
                            <th>is_admin</th>
                        </tr>
                    </thead>
                    <tbody>
            `;

            list.forEach(u => {
                html += `
                    <tr>
                        <td><input type="radio" name="selectedUser" value="${u.id}"></td>
                        <td>${u.avatar ? `<img src="https://prada-party.onrender.com/api/files/users/${u.id}/${u.avatar}" class="avatar-img">` : ""}</td>
                        <td>${u.first_name ?? ""}</td>
                        <td>${u.last_name ?? ""}</td>
                        <td>${u.phone ?? ""}</td>
                        <td>${u.address ?? ""}</td>
                        <td>${u.postal_code ?? ""}</td>
                        <td>${u.birthdate ? u.birthdate.split(" ")[0] : ""}</td>
                        <td>${u.is_admin ? "Да" : "Нет"}</td>
                    </tr>
                `;
            });

            html += `</tbody></table>`;
            this.tableHtml = html;

            setTimeout(() => this.initSelection(), 50);
        },


        filterUsers(query) {
            query = query.trim().toLowerCase();

            if (!query) {
                this.searchExact = false;
                this.renderUsersTable(this.users);
                return;
            }

            const filtered = this.users.filter(u => {
                const fields = [
                    u.email,
                    u.first_name,
                    u.last_name,
                    u.phone,
                    u.address,
                    String(u.postal_code),
                    u.birthdate,
                    u.is_admin ? "да" : "нет"
                ]
                .filter(Boolean)
                .map(f => f.toLowerCase());

                if (this.searchExact) {
                    return fields.includes(query);
                } else {
                    return fields.some(f => f.includes(query));
                }
            });

            this.renderUsersTable(filtered);

            if (this.searchExact) {
                this.searchExact = false;
            }
        },

        initSelection() {
            document.querySelectorAll("input[name='selectedUser']").forEach(radio => {
                radio.addEventListener("change", () => {
                    this.selectedUserId = radio.value;
                });
            });
        },


        async createUser() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            if (!this.validateUser("create", false)) return;

            try {
                const form = new FormData();
                form.append("email", document.querySelector("#create_email").value);
                form.append("password", document.querySelector("#create_password").value);
                form.append("passwordConfirm", document.querySelector("#create_password").value);

                const avatar = document.querySelector("#create_avatar").files[0];
                if (avatar) form.append("avatar", avatar);

                form.append("first_name", document.querySelector("#create_first_name").value);
                form.append("last_name", document.querySelector("#create_last_name").value);
                form.append("phone", document.querySelector("#create_phone").value);
                form.append("address", document.querySelector("#create_address").value);
                form.append("postal_code", document.querySelector("#create_postal_code").value);
                form.append("birthdate", document.querySelector("#create_birthdate").value);

                await pb.collection("users").create(form);

                this.closeCreateModal();
                this.loadUsersTable();
                this.showToast("Пользователь создан");

            } catch (err) {
                const data = err?.data || err?.response?.data || {};
                const msg = (err?.message || "").toLowerCase();

                const emailExists = !!(
                    data?.email?.message ||
                    (typeof data === 'string' && /email.*exist|already.*exists|duplicate/i.test(data)) ||
                    /email.*exist|already.*exists|duplicate/i.test(msg) ||
                    (data && Object.values(data).some(v => String(v).toLowerCase().includes('email') && String(v).toLowerCase().includes('exist')))
                );

                if (emailExists) {
                    return this.showModalError("create", "Пользователь с такой почтой уже существует");
                }

                if (data?.password?.message || /password.*length|password.*8/i.test(msg)) {
                    return this.showModalError("create", "Пароль должен быть минимум 8 символов");
                }

                this.showModalError("create", "Ошибка при создании пользователя");
            }
        },

        async updateUser() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            if (!this.validateUser("edit", true)) return;

            const id = document.querySelector("#edit_id").value;

            try {
                const form = new FormData();
                form.append("first_name", document.querySelector("#edit_first_name").value);
                form.append("last_name", document.querySelector("#edit_last_name").value);
                form.append("phone", document.querySelector("#edit_phone").value);
                form.append("address", document.querySelector("#edit_address").value);
                form.append("postal_code", document.querySelector("#edit_postal_code").value);
                form.append("birthdate", document.querySelector("#edit_birthdate").value);
                form.append("is_admin", document.querySelector("#edit_is_admin").checked);

                const avatar = document.querySelector("#edit_avatar").files[0];
                if (avatar) form.append("avatar", avatar);

                await pb.collection("users").update(id, form);

                this.closeEditModal();
                this.loadUsersTable();
                this.showToast("Пользователь обновлён");

            } catch (err) {
                const data = err?.data || err?.response?.data || {};
                console.error('Update user error:', err);
                this.showModalError("edit", "Ошибка при обновлении пользователя");
            }
        },

        logout() {
            const pb = new PocketBase('https://prada-party.onrender.com');
            pb.authStore.clear();
            window.location.href = "index.html";
        }
    }
}
