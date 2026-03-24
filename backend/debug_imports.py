
import pkgutil
import langchain
import langchain_community

def find_submodules(package):
    if hasattr(package, "__path__"):
        for importer, modname, ispkg in pkgutil.walk_packages(package.__path__, package.__name__ + "."):
            if "multi_query" in modname or "MultiQueryRetriever" in modname:
                print(f"Found: {modname}")
            try:
                module = __import__(modname, fromlist=["MultiQueryRetriever"])
                if hasattr(module, "MultiQueryRetriever"):
                    print(f"Found class in: {modname}")
            except Exception:
                pass

print("Searching langchain...")
find_submodules(langchain)
print("Searching langchain_community...")
find_submodules(langchain_community)
