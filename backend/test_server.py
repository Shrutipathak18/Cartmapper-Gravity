
print("Importing main...")
try:
    from main import app
    print("Main imported successfully.")
except Exception as e:
    print(f"Error importing main: {e}")
    import traceback
    traceback.print_exc()

if __name__ == "__main__":
    print("Starting uvicorn...")
    import uvicorn
    try:
        uvicorn.run(app, host="127.0.0.1", port=8000)
    except Exception as e:
        print(f"Error running uvicorn: {e}")
