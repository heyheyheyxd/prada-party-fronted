function ordersPage() {
    return {
        orderNumber: null,
        items: [],

        async init() {
            const pb = new PocketBase("https://prada-party.onrender.com");

            const params = new URLSearchParams(window.location.search);
            this.orderNumber = params.get("order");

            if (!this.orderNumber) return;

            const list = await pb.collection("orders").getList(1, 1, {
                filter: `order_number = ${this.orderNumber}`
            });

            if (list.items.length > 0) {
                this.items = list.items[0].items;
            }
        }
    }
}

