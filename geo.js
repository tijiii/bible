const GEO = {
  "France":         ["Paris","Lyon","Marseille","Bordeaux","Toulouse","Nice","Nantes","Strasbourg","Lille","Rennes","Montpellier","Grenoble","Dijon","Angers","Metz","Reims","Rouen","Toulon","Brest","Clermont-Ferrand"],
  "Royaume-Uni":    ["London","Manchester","Birmingham","Glasgow","Edinburgh","Bristol","Leeds","Liverpool","Cardiff","Belfast","Brighton","Oxford","Cambridge","Nottingham","Sheffield","Newcastle"],
  "États-Unis":     ["New York","Los Angeles","Chicago","Miami","San Francisco","Atlanta","Dallas","Seattle","Boston","Houston","Las Vegas","Portland","Denver","Austin","Nashville","Philadelphia","Phoenix","Detroit","Minneapolis"],
  "Allemagne":      ["Berlin","Munich","Hamburg","Cologne","Frankfurt","Stuttgart","Düsseldorf","Leipzig","Dortmund","Dresden","Nuremberg","Hanover"],
  "Espagne":        ["Madrid","Barcelona","Seville","Valencia","Bilbao","Malaga","Granada","Ibiza","San Sebastian","Zaragoza"],
  "Italie":         ["Milan","Rome","Florence","Naples","Turin","Venice","Bologna","Palermo","Genoa"],
  "Pays-Bas":       ["Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven"],
  "Belgique":       ["Brussels","Antwerp","Ghent","Liège","Bruges"],
  "Suisse":         ["Zurich","Geneva","Basel","Bern","Lausanne"],
  "Portugal":       ["Lisbon","Porto","Faro","Braga","Coimbra"],
  "Autriche":       ["Vienna","Graz","Linz","Salzburg","Innsbruck"],
  "Suède":          ["Stockholm","Gothenburg","Malmö","Uppsala"],
  "Norvège":        ["Oslo","Bergen","Trondheim","Stavanger"],
  "Danemark":       ["Copenhagen","Aarhus","Odense"],
  "Finlande":       ["Helsinki","Tampere","Turku"],
  "Pologne":        ["Warsaw","Krakow","Gdansk","Wroclaw","Poznan"],
  "Australie":      ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra"],
  "Japon":          ["Tokyo","Osaka","Kyoto","Fukuoka","Sapporo","Nagoya"],
  "Canada":         ["Toronto","Montreal","Vancouver","Calgary","Ottawa","Edmonton"],
  "Brésil":         ["São Paulo","Rio de Janeiro","Brasília","Salvador","Fortaleza"],
  "Mexique":        ["Mexico City","Guadalajara","Monterrey","Cancún"],
  "Argentine":      ["Buenos Aires","Córdoba","Rosario","Mendoza"],
  "Colombie":       ["Bogotá","Medellín","Cali","Barranquilla"],
  "Afrique du Sud": ["Cape Town","Johannesburg","Durban","Pretoria"],
  "Maroc":          ["Casablanca","Marrakech","Rabat","Fès","Tanger"],
  "Sénégal":        ["Dakar","Saint-Louis","Thiès"],
  "Côte d'Ivoire":  ["Abidjan","Bouaké","Yamoussoukro"],
  "Émirats Arabes": ["Dubai","Abu Dhabi","Sharjah"],
  "Chine":          ["Beijing","Shanghai","Shenzhen","Guangzhou","Chengdu"],
  "Corée du Sud":   ["Seoul","Busan","Incheon"],
  "Inde":           ["Mumbai","Delhi","Bangalore","Chennai","Hyderabad"],
  "Thaïlande":      ["Bangkok","Chiang Mai","Phuket"],
  "Autre":          ["—"]
};

const FLAGS = {
  "France":"🇫🇷","Royaume-Uni":"🇬🇧","États-Unis":"🇺🇸","Allemagne":"🇩🇪",
  "Espagne":"🇪🇸","Italie":"🇮🇹","Pays-Bas":"🇳🇱","Belgique":"🇧🇪",
  "Suisse":"🇨🇭","Portugal":"🇵🇹","Autriche":"🇦🇹","Suède":"🇸🇪",
  "Norvège":"🇳🇴","Danemark":"🇩🇰","Finlande":"🇫🇮","Pologne":"🇵🇱",
  "Australie":"🇦🇺","Japon":"🇯🇵","Canada":"🇨🇦","Brésil":"🇧🇷",
  "Mexique":"🇲🇽","Argentine":"🇦🇷","Colombie":"🇨🇴","Afrique du Sud":"🇿🇦",
  "Maroc":"🇲🇦","Sénégal":"🇸🇳","Côte d'Ivoire":"🇨🇮","Émirats Arabes":"🇦🇪",
  "Chine":"🇨🇳","Corée du Sud":"🇰🇷","Inde":"🇮🇳","Thaïlande":"🇹🇭","Autre":"🌍"
};

const COUNTRIES = Object.keys(GEO);
