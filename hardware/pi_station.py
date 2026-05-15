import paho.mqtt.client as mqtt
import json
import time
import random
import os

# MQTT Configuration (Use Environment Variables for Production)
MQTT_BROKER = os.getenv("MQTT_BROKER", "test.mosquitto.org")
MQTT_PORT = int(os.getenv("MQTT_PORT", 1883))
MQTT_USER = os.getenv("MQTT_USER", None)
MQTT_PASS = os.getenv("MQTT_PASS", None)
STATION_ID = os.getenv("STATION_ID", "ST-001")

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print(f"✅ Connected to MQTT Broker: {MQTT_BROKER}")
        # Publish initial status
        client.publish(f"stations/{STATION_ID}/status", json.dumps({"status": "online"}), qos=1, retain=True)
    else:
        print(f"❌ Connection failed with code {rc}")

def on_publish(client, userdata, mid):
    # print(f"📤 Message {mid} Published")
    pass

client = mqtt.Client(client_id=f"pi_station_{STATION_ID}")
if MQTT_USER and MQTT_PASS:
    client.username_pw_set(MQTT_USER, MQTT_PASS)

client.on_connect = on_connect
client.on_publish = on_publish

print(f"🚀 Starting EV Station Controller: {STATION_ID}")
client.connect(MQTT_BROKER, MQTT_PORT, 60)
client.loop_start()

energy_consumed = 0.0

try:
    while True:
        # 1. Publish Heartbeat (every 20s - Threshold is 30s)
        client.publish(f"stations/{STATION_ID}/heartbeat", json.dumps({"timestamp": time.time()}), qos=0)
        
        # 2. Simulate Real-time Charging Data
        energy_consumed += 0.01  # Simulate energy usage
        
        telemetry = {
            "voltage": round(230 + random.uniform(-5, 5), 1),
            "current": round(16 + random.uniform(-2, 2), 1),
            "power": round(7.2 + random.uniform(-0.5, 0.5), 1),
            "energyConsumed": round(energy_consumed, 3),
            "chargingSpeed": 7.2,
            "connectorStatus": "locked",
            "chargingStatus": "charging",
            "temperature": round(35 + random.uniform(0, 5), 1)
        }
        
        client.publish(f"stations/{STATION_ID}/live", json.dumps(telemetry), qos=1)
        
        # 3. Random Alert Simulation (1 in 100 chance)
        if random.random() < 0.01:
            alert = {
                "type": "overheat",
                "severity": "high",
                "message": "Internal temperature exceeding safety limits!"
            }
            client.publish(f"stations/{STATION_ID}/alerts", json.dumps(alert), qos=1)
            print("⚠️ ALERT SENT: Overheat detected")

        time.sleep(10) # Publish every 10 seconds

except KeyboardInterrupt:
    print("🛑 Stopping Station Controller...")
    client.publish(f"stations/{STATION_ID}/status", json.dumps({"status": "offline"}), qos=1, retain=True)
    client.loop_stop()
    client.disconnect()
