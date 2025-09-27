import os
from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from typing import List, Dict, Any
import json
import asyncio
import pandas as pd
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load CSV once
df = pd.read_csv("pbp-2024.csv")

# Store plays + indices per game
game_buffers: Dict[str, List[Dict[str, Any]]] = {}
last_sent_indices: Dict[str, int] = {}


def prepare_game(game_id: str):
    """
    Prepare play buffer for a given GameId if not already cached.
    """
    if game_id in game_buffers:
        return

    game_df = df[df["GameId"] == int(game_id)].copy()

    game_df["TotalSecondsRemaining"] = (
        (4 - game_df["Quarter"]) * 15 * 60
        + game_df["Minute"] * 60
        + game_df["Second"]
    )

    df_sorted = game_df.sort_values("TotalSecondsRemaining", ascending=False)

    play_buffer = []
    for _, row in df_sorted.iterrows():
        play = {
            "quarter": row["Quarter"],
            "time": row["TotalSecondsRemaining"],
            "description": row["Description"],
            "yards_gained": row["Yards"],
            "offense_team": row["OffenseTeam"],
            "defense_team": row["DefenseTeam"],
            "down": row["Down"],
            "yards_to_go": row["ToGo"],
            "yard_line": row["YardLine"]
        }
        play_buffer.append(play)

    game_buffers[game_id] = play_buffer
    last_sent_indices[game_id] = 0


async def play_streamer(game_id: str):
    """
    Generator that yields plays for a specific GameId.
    """
    prepare_game(game_id)

    while last_sent_indices[game_id] < len(game_buffers[game_id]):
        play_data = game_buffers[game_id][last_sent_indices[game_id]]
        yield f"data: {json.dumps(play_data)}\n\n"
        last_sent_indices[game_id] += 1
        await asyncio.sleep(5)


@app.get("/stream-plays/{game_id}")
async def stream_plays(game_id: str):
    """
    SSE endpoint to stream plays for a specific GameId.
    """
    return StreamingResponse(play_streamer(game_id), media_type="text/event-stream")
