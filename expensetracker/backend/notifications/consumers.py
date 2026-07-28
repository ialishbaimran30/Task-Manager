import json
from channels.generic.websocket import AsyncWebsocketConsumer

class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        # Authenticated user scope check
        self.user = self.scope.get("user")
        
        if self.user and self.user.is_authenticated:
            # Group Name Format: user_<id>
            self.room_group_name = f"user_{self.user.id}"
            
            # Join Group
            await self.channel_layer.group_add(
                self.room_group_name,
                self.channel_name
            )
            await self.accept()
            print(f"🟢 WebSocket Connected for User: {self.user.id}")
        else:
            await self.close()

    async def disconnect(self, close_code):
        if hasattr(self, "room_group_name"):
            await self.channel_layer.group_discard(
                self.room_group_name,
                self.channel_name
            )

    # ⚠️ THIS METHOD NAME MUST MATCH "type": "send_notification" IN SIGNALS
    async def send_notification(self, event):
        notification = event["notification"]
        # Client (Frontend) ko JSON send karna
        await self.send(text_data=json.dumps({
            "type": "notification",
            "notification": notification
        }))