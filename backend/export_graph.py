"""
Export LangGraph flow diagram to doc/ folder.
Usage: python export_graph.py
Outputs: doc/graph_flow.mmd (Mermaid), doc/graph_flow.png (PNG)
"""
import os
import sys

# Ensure backend is on path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from game.graph import build_graph

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "doc")
os.makedirs(OUT_DIR, exist_ok=True)


def main():
    print("[Graph Export] Building graph...")
    graph = build_graph()
    graph_obj = graph.get_graph()

    # 1. Mermaid markdown
    mermaid_path = os.path.join(OUT_DIR, "graph_flow.mmd")
    mermaid_str = graph_obj.draw_mermaid()
    with open(mermaid_path, "w", encoding="utf-8") as f:
        f.write(mermaid_str)
    print(f"[Graph Export] OK Mermaid saved -> {mermaid_path}")

    # 2. PNG image
    png_path = os.path.join(OUT_DIR, "graph_flow.png")
    png_bytes = graph_obj.draw_mermaid_png()
    with open(png_path, "wb") as f:
        f.write(png_bytes)
    print(f"[Graph Export] OK PNG saved -> {png_path}")

    # 3. ASCII art (print to console + save to file) — optional, needs `grandalf`
    try:
        ascii_path = os.path.join(OUT_DIR, "graph_flow.txt")
        ascii_str = graph_obj.draw_ascii()
        with open(ascii_path, "w", encoding="utf-8") as f:
            f.write(ascii_str)
        print(f"[Graph Export] OK ASCII saved -> {ascii_path}")
        print("\n" + ascii_str)
    except ImportError:
        print("[Graph Export] SKIP ASCII: install `grandalf` to enable")


if __name__ == "__main__":
    main()
