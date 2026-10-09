import sqlite3
import hashlib
import time
import re
from fastapi import FastAPI
from pydantic import BaseModel
from fastapi.middleware.cors import CORSMiddleware
from typing import List

app = FastAPI()

# Allow CORS for the frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

DB_PATH = "piju_brain.db"

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            name TEXT,
            type INTEGER, 
            val INTEGER,
            desc TEXT,
            hash TEXT
        )
    """)
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS links (
            source TEXT,
            target TEXT
        )
    """)
    
    # Check if empty, then seed with mock data
    cursor.execute("SELECT COUNT(*) FROM nodes")
    if cursor.fetchone()[0] == 0:
        print("Seeding database...")
        # Caminhões (Recepção) - Azul (1)
        nodes = [
            ('C1', 'Caminhão ABC-1234', 1, 20, 'Chegada: 08:30 | 15.000 L'),
            ('C2', 'Caminhão XYZ-9876', 1, 20, 'Chegada: 09:15 | 22.000 L'),
            ('C3', 'Caminhão KKK-5555', 1, 20, 'Chegada: 10:00 | 10.000 L'),
            ('S1', 'Silo Leite Cru #05', 3, 30, 'Capacidade: 100.000 L | Temp: 4ºC'),
            ('P1', 'Pasteurizador A', 3, 25, 'Status: Ativo | Temp: 74ºC | Tempo: 15s'),
            ('UHT', 'Tratamento UHT', 3, 25, 'Status: Ativo | Temp: 140ºC | Tempo: 3s'),
            ('TA', 'Tanque Asséptico', 3, 25, 'Status: Enchendo'),
            ('LOTE1', 'Lote UHT #10294', 4, 35, 'Validade: 120 dias | Qtde: 50.000 caixas')
        ]
        for n in nodes:
            h = hashlib.sha256(str(n).encode()).hexdigest()
            cursor.execute("INSERT INTO nodes (id, name, type, val, desc, hash) VALUES (?, ?, ?, ?, ?, ?)", (*n, h))
            
        links = [
            ('S1', 'P1'),
            ('P1', 'UHT'),
            ('UHT', 'TA'),
            ('TA', 'LOTE1')
        ]
        for l in links:
            cursor.execute("INSERT INTO links (source, target) VALUES (?, ?)", l)
            
    conn.commit()
    conn.close()

init_db()

class ChatRequest(BaseModel):
    message: str

@app.get("/api/graph")
def get_graph():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, name, type, val, desc, hash FROM nodes")
    nodes_db = cursor.fetchall()
    nodes = [{"id": n[0], "name": n[1], "group": n[2], "val": n[3], "desc": n[4], "hash": n[5]} for n in nodes_db]
    
    cursor.execute("SELECT source, target FROM links")
    links_db = cursor.fetchall()
    links = [{"source": l[0], "target": l[1]} for l in links_db]
    
    conn.close()
    return {"nodes": nodes, "links": links}

@app.post("/api/chat")
def chat_with_ia(req: ChatRequest):
    # Simulated IA processing
    msg = req.message.lower()
    
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    # Try to find a truck mentioned (e.g., "ABC-1234")
    truck_match = re.search(r'([a-z]{3}-?\d{4})', msg)
    truck_id = None
    if truck_match:
        truck_placa = truck_match.group(1).upper().replace('-', '')
        cursor.execute("SELECT id FROM nodes WHERE type=1 AND name LIKE ?", (f'%{truck_placa[:3]}-{truck_placa[3:]}%',))
        res = cursor.fetchone()
        if res:
            truck_id = res[0]
            
    if not truck_id:
        truck_id = 'C1' # Default fallback
        
    # Generate new node (Laudo - group 2)
    new_id = f"L{int(time.time())}"
    desc = f"Laudo gerado via IA. Extraído: {req.message}"
    
    data_str = f"{new_id}-Laudo-{desc}-{time.time()}"
    h = hashlib.sha256(data_str.encode()).hexdigest()
    
    cursor.execute("INSERT INTO nodes (id, name, type, val, desc, hash) VALUES (?, ?, ?, ?, ?, ?)", 
                   (new_id, f"Laudo Lab", 2, 15, desc, h))
    
    # Connect to truck
    cursor.execute("INSERT INTO links (source, target) VALUES (?, ?)", (truck_id, new_id))
    # Connect to Silo (S1)
    cursor.execute("INSERT INTO links (source, target) VALUES (?, ?)", (new_id, 'S1'))
    
    conn.commit()
    conn.close()
    
    return {
        "reply": f"Entendido. Os dados da análise foram extraídos e validados.\n\nO laudo **{new_id}** foi gerado de forma imutável (Hash: `{h[:10]}...`). O lote já foi conectado ao caminhão correspondente e liberado para o silo no Segundo Cérebro.",
        "new_node_hash": h,
        "new_node_id": new_id
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
