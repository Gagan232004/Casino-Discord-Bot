import time
from duckduckgo_search import DDGS
import urllib.request

def get_gifs():
    with DDGS() as ddgs:
        results = list(ddgs.images("casino roulette wheel spinning animation", max_results=20))
        
        count = 0
        for r in results:
            url = r['image']
            if url.endswith('.gif'):
                print(f"Downloading {url}")
                try:
                    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
                    with urllib.request.urlopen(req, timeout=10) as response, open(f'src/assets/roulette{count}.gif', 'wb') as out_file:
                        out_file.write(response.read())
                    print(f"Saved to src/assets/roulette{count}.gif")
                    count += 1
                    if count >= 3:
                        break
                except Exception as e:
                    print(f"Failed to download {url}: {e}")

if __name__ == '__main__':
    get_gifs()
