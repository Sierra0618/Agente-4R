import webbrowser
import threading
import time
import uvicorn

def open_browser():
    """Wait for server to start and then open default browser."""
    time.sleep(1.5)
    webbrowser.open("http://127.0.0.1:8000")

if __name__ == "__main__":
    print("=" * 60)
    print("  Microsoft AI Foundry - Agent Studio Front-end")
    print("  Iniciando servidor em http://127.0.0.1:8000 ...")
    print("=" * 60)
    
    # Launch browser thread
    threading.Thread(target=open_browser, daemon=True).start()
    
    # Start server
    uvicorn.run("server:app", host="127.0.0.1", port=8000, reload=False)
