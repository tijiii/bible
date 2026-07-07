const GEO = {
  "France":         ["Paris","Lyon","Marseille","Bordeaux","Toulouse","Nice","Nantes","Strasbourg","Lille","Rennes","Montpellier","Grenoble","Brest","Dijon","Angers","Metz","Reims","Rouen","Clermont-Ferrand","Toulon"],
  "Royaume-Uni":    ["London","Manchester","Birmingham","Glasgow","Edinburgh","Bristol","Leeds","Liverpool","Cardiff","Belfast","Brighton","Oxford","Cambridge","Nottingham","Sheffield","Newcastle"],
  "États-Unis":     ["New York","Los Angeles","Chicago","Miami","San Francisco","Atlanta","Dallas","Seattle","Boston","Houston","Las Vegas","Portland","Denver","Austin","Nashville","Philadelphia","Phoenix","Detroit","Minneapolis"],
  "Allemagne":      ["Berlin","Munich","Hamburg","Cologne","Frankfurt","Stuttgart","Düsseldorf","Leipzig","Dortmund","Dresden","Nuremberg","Hanover","Bremen","Essen"],
  "Espagne":        ["Madrid","Barcelona","Seville","Valencia","Bilbao","Malaga","Granada","Ibiza","San Sebastian","Zaragoza","Alicante","Murcia","Valladolid"],
  "Italie":         ["Milan","Rome","Florence","Naples","Turin","Venice","Bologna","Palermo","Genoa","Bari","Catania","Verona","Padua"],
  "Pays-Bas":       ["Amsterdam","Rotterdam","The Hague","Utrecht","Eindhoven","Groningen","Tilburg","Almere"],
  "Belgique":       ["Brussels","Antwerp","Ghent","Liège","Bruges","Namur","Mons"],
  "Suisse":         ["Zurich","Geneva","Basel","Bern","Lausanne","Lucerne","St. Gallen"],
  "Portugal":       ["Lisbon","Porto","Faro","Braga","Coimbra","Funchal"],
  "Autriche":       ["Vienna","Graz","Linz","Salzburg","Innsbruck"],
  "Suède":          ["Stockholm","Gothenburg","Malmö","Uppsala","Västerås"],
  "Norvège":        ["Oslo","Bergen","Trondheim","Stavanger"],
  "Danemark":       ["Copenhagen","Aarhus","Odense","Aalborg"],
  "Finlande":       ["Helsinki","Tampere","Turku","Oulu"],
  "Pologne":        ["Warsaw","Krakow","Gdansk","Wroclaw","Poznan","Lodz"],
  "Australie":      ["Sydney","Melbourne","Brisbane","Perth","Adelaide","Canberra","Gold Coast","Hobart"],
  "Japon":          ["Tokyo","Osaka","Kyoto","Fukuoka","Sapporo","Nagoya","Kobe","Hiroshima"],
  "Canada":         ["Toronto","Montreal","Vancouver","Calgary","Ottawa","Edmonton","Quebec City","Winnipeg"],
  "Brésil":         ["São Paulo","Rio de Janeiro","Brasília","Salvador","Fortaleza","Belo Horizonte","Curitiba","Recife"],
  "Mexique":        ["Mexico City","Guadalajara","Monterrey","Cancún","Puebla","Tijuana","Mérida"],
  "Argentine":      ["Buenos Aires","Córdoba","Rosario","Mendoza","La Plata"],
  "Colombie":       ["Bogotá","Medellín","Cali","Barranquilla","Cartagena"],
  "Afrique du Sud": ["Cape Town","Johannesburg","Durban","Pretoria","Port Elizabeth"],
  "Maroc":          ["Casablanca","Marrakech","Rabat","Fès","Tanger","Agadir"],
  "Sénégal":        ["Dakar","Saint-Louis","Thiès","Ziguinchor"],
  "Côte d'Ivoire":  ["Abidjan","Bouaké","Yamoussoukro","San Pédro"],
  "Émirats Arabes": ["Dubai","Abu Dhabi","Sharjah"],
  "Chine":          ["Beijing","Shanghai","Shenzhen","Guangzhou","Chengdu","Hangzhou","Wuhan","Xi'an"],
  "Corée du Sud":   ["Seoul","Busan","Incheon","Daegu","Gwangju"],
  "Inde":           ["Mumbai","Delhi","Bangalore","Chennai","Hyderabad","Kolkata","Pune","Ahmedabad"],
  "Thaïlande":      ["Bangkok","Chiang Mai","Phuket","Pattaya"],
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
