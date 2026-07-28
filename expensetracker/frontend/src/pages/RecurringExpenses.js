import { useEffect, useState } from "react";
import api from "../api/axios";

export default function RecurringExpenses() {
    const [items, setItems] = useState([]);
    const load = async () => {
        const res = await api.get("/expenses/recurring/");
        setItems(res.data.results || res.data);
    };

    useEffect(() => {
        load();
    }, []);

    const deleteItem = async (id) => {

        if (!window.confirm("Delete recurring expense?"))
            return;

        await api.delete(`/expenses/recurring/${id}/`);

        load();
    };

    return (
        <div>

            <h2>Recurring Expenses</h2>
            {items.length === 0 ? (
                <p>No recurring expenses.</p>

            ) : (

                items.map(item => (
                    <div
                        key={item.id}
                        className="glass"
                        style={{
                            padding: 20,
                            marginBottom: 20,
                            borderRadius: 12,
                        }}
                    >

                        <h3>{item.title}</h3>

                        <p>
                            Rs {item.amount}
                        </p>

                        <p>
                            Every {item.frequency}
                        </p>

                        <button
                            className="btn btn-danger"
                            onClick={() => deleteItem(item.id)}
                        >
                            Delete
                        </button>

                    </div>

                ))

            )}

        </div>

    );

}