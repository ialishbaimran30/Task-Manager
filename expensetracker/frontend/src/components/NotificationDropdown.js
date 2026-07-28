import React from "react";
import { useNotification } from "../context/NotificationContext";
export default function NotificationDropdown() {
    const { notifications } = useNotification();
    return (
        <div
            style={{
                position: "absolute",
                right: 0,
                top: 35,
                width: 320,
                background: "white",
                border: "1px solid #ddd",
                borderRadius: 8,
                padding: 10,
                zIndex: 1000
            }}
        >
            {
                notifications.length === 0 ?

                    <p>No Notifications</p>

                    :

                    notifications.map(item => (
                        <div
                            key={item.id}
                            style={{
                                borderBottom: "1px solid #eee",
                                padding: "10px 0"
                            }}
                        >
                            <strong>
                                {item.title}
                            </strong>
                            <p>
                                {item.message}

                            </p>

                        </div>

                    ))

            }

        </div>

    );

}