from flask import Flask, jsonify
from flask_cors import CORS
import requests
import re
import urllib3

# Deshabilitar advertencias
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

app = Flask(__name__)

# === HABILITAR CORS ===
# Permitir todas las solicitudes de cualquier origen
CORS(app)

# O si quieres ser más específico:
# CORS(app, origins=['http://localhost:3000', 'https://tusitio.com'])

def obtener_precios_bcv():
    """Obtiene los precios del dólar y euro desde el BCV"""
    url = 'https://www.bcv.org.ve/'
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.8,en-US;q=0.5,en;q=0.3',
    }
    
    try:
        print("🔄 Conectando al BCV...")
        
        session = requests.Session()
        session.verify = False
        
        response = session.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        html = response.text
        print(f"✅ Página cargada: {len(html)} bytes")
        
        usd = None
        eur = None
        fecha = None
        
        # === EXTRAER TODAS LAS MONEDAS ===
        patron_monedas = r'id="([a-z]+)"[^>]*>.*?<strong[^>]*>([\d.,]+)</strong>'
        matches = re.findall(patron_monedas, html, re.DOTALL)
        
        monedas = {}
        for moneda, valor in matches:
            valor_limpio = valor.replace('.', '').replace(',', '.')
            monedas[moneda] = float(valor_limpio)
        
        print(f"🔍 Monedas encontradas: {monedas}")
        
        # === DÓLAR ===
        if 'dolar' in monedas:
            usd = monedas['dolar']
            print(f"✅ USD encontrado: {usd}")
        else:
            # Buscar USD en el HTML
            idx = html.find('USD')
            if idx != -1:
                seccion = html[idx:idx+300]
                numeros = re.findall(r'([\d.,]+)', seccion)
                for num in numeros:
                    num_limpio = num.replace('.', '').replace(',', '.')
                    if float(num_limpio) > 100:
                        usd = float(num_limpio)
                        print(f"✅ USD encontrado en sección: {usd}")
                        break
        
        # === EURO ===
        if 'euro' in monedas and monedas['euro'] > 100:
            eur = monedas['euro']
            print(f"✅ EUR encontrado: {eur}")
        else:
            # Buscar en el HTML por EUR
            idx = html.find('EUR')
            if idx != -1:
                seccion = html[idx:idx+300]
                numeros = re.findall(r'([\d.,]+)', seccion)
                for num in numeros:
                    num_limpio = num.replace('.', '').replace(',', '.')
                    if float(num_limpio) > 100:
                        eur = float(num_limpio)
                        print(f"✅ EUR encontrado en sección: {eur}")
                        break
        
        # === FECHA ===
        patron_fecha = r'Fecha Valor:.*?<span[^>]*>([^<]+)</span>'
        match_fecha = re.search(patron_fecha, html)
        if match_fecha:
            fecha = match_fecha.group(1).strip()
            print(f"✅ Fecha: {fecha}")
        else:
            patron_fecha2 = r'Fecha Valor:\s*([^<]+)'
            match_fecha2 = re.search(patron_fecha2, html)
            if match_fecha2:
                fecha = match_fecha2.group(1).strip()
                print(f"✅ Fecha (alternativo): {fecha}")
        
        return usd, eur, fecha
        
    except Exception as e:
        print(f"❌ Error: {e}")
        return None, None, None

@app.route('/api/tipo-cambio')
def api_tipo_cambio():
    """Obtiene todos los precios actualizados"""
    print("🔄 Recibida petición a /api/tipo-cambio")
    usd, eur, fecha = obtener_precios_bcv()
    
    if usd is None or eur is None:
        return jsonify({
            "exito": False,
            "mensaje": "No se pudieron obtener los datos del BCV",
            "error": "No se encontraron los valores del dólar o euro en la página",
            "datos_encontrados": {
                "dolar_encontrado": usd is not None,
                "euro_encontrado": eur is not None,
                "fecha_encontrada": fecha is not None
            }
        }), 404
    
    return jsonify({
        "exito": True,
        "fecha_valor": fecha,
        "precios": {
            "dolar_bs": usd,
            "euro_bs": eur
        },
        "fuente": "Banco Central de Venezuela",
        "moneda_base": "Bolívar (Bs.)"
    })

@app.route('/api/dolar')
def api_dolar():
    """Obtiene solo el precio del dólar"""
    usd, _, _ = obtener_precios_bcv()
    
    if usd is None:
        return jsonify({
            "exito": False,
            "mensaje": "No se encontró el valor del dólar",
            "moneda": "Dólar Americano"
        }), 404
    
    return jsonify({
        "exito": True,
        "moneda": "Dólar Americano",
        "precio_bs": usd,
        "moneda_base": "Bolívar (Bs.)"
    })

@app.route('/api/euro')
def api_euro():
    """Obtiene solo el precio del euro"""
    _, eur, _ = obtener_precios_bcv()
    
    if eur is None:
        return jsonify({
            "exito": False,
            "mensaje": "No se encontró el valor del euro",
            "moneda": "Euro"
        }), 404
    
    return jsonify({
        "exito": True,
        "moneda": "Euro",
        "precio_bs": eur,
        "moneda_base": "Bolívar (Bs.)"
    })

@app.route('/debug')
def debug():
    """Endpoint de depuración - muestra todas las monedas encontradas"""
    try:
        session = requests.Session()
        session.verify = False
        
        response = session.get('https://www.bcv.org.ve/', timeout=10)
        html = response.text
        
        # Extraer todas las monedas
        patron = r'id="([a-z]+)"[^>]*>.*?<strong[^>]*>([\d.,]+)</strong>'
        matches = re.findall(patron, html, re.DOTALL)
        
        monedas = {}
        for moneda, valor in matches:
            valor_limpio = valor.replace('.', '').replace(',', '.')
            monedas[moneda] = float(valor_limpio)
        
        # Buscar USD en el HTML
        usd_directo = None
        idx = html.find('USD')
        if idx != -1:
            seccion = html[idx:idx+300]
            numeros = re.findall(r'([\d.,]+)', seccion)
            for num in numeros:
                num_limpio = num.replace('.', '').replace(',', '.')
                if float(num_limpio) > 100:
                    usd_directo = float(num_limpio)
                    break
        
        # Buscar EUR en el HTML
        eur_directo = None
        idx = html.find('EUR')
        if idx != -1:
            seccion = html[idx:idx+300]
            numeros = re.findall(r'([\d.,]+)', seccion)
            for num in numeros:
                num_limpio = num.replace('.', '').replace(',', '.')
                if float(num_limpio) > 100:
                    eur_directo = float(num_limpio)
                    break
        
        return jsonify({
            "exito": True,
            "monedas_por_id": monedas,
            "usd_encontrado_directo": usd_directo,
            "eur_encontrado_directo": eur_directo,
            "html_length": len(html)
        })
    except Exception as e:
        return jsonify({
            "exito": False,
            "error": str(e)
        }), 500

@app.route('/')
def home():
    return jsonify({
        "mensaje": "API de tipos de cambio del BCV",
        "status": "online",
        "endpoints": {
            "/": "Información de la API",
            "/api/tipo-cambio": "Obtener precios del dólar y euro",
            "/api/dolar": "Obtener solo el precio del dólar",
            "/api/euro": "Obtener solo el precio del euro",
            "/debug": "Depuración - muestra monedas encontradas"
        },
        "ejemplo": "http://localhost:5001/api/tipo-cambio"
    })

if __name__ == '__main__':
    print("=" * 60)
    print("🚀 SERVIDOR DE TIPOS DE CAMBIO BCV")
    print("=" * 60)
    print("📌 Endpoints disponibles:")
    print("  ✅ http://localhost:5001/")
    print("  ✅ http://localhost:5001/api/tipo-cambio")
    print("  ✅ http://localhost:5001/api/dolar")
    print("  ✅ http://localhost:5001/api/euro")
    print("  ✅ http://localhost:5001/debug")
    print("=" * 60)
    print("🌐 CORS habilitado - Puedes consumir desde cualquier dominio")
    print("=" * 60)
    app.run(debug=True, host='0.0.0.0', port=5001)