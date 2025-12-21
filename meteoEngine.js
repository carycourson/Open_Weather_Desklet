const Soup = imports.gi.Soup;

var _httpSession;
if (typeof _httpSession === 'undefined') {
    _httpSession = new Soup.Session();
}

var MeteoEngine = class MeteoEngine {


    // --- OPEN-METEO (FREE) ---
    fetchMeteo(location, units, onSuccess) {
        let lat = location.split(",")[0].trim();
        let lon = location.split(",")[1].trim();
        
        let unitTemp = (units === "imperial") ? "fahrenheit" : "celsius";
        let unitWind = (units === "imperial") ? "mph" : "ms";

        let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m,wind_direction_10m&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max,wind_speed_10m_max&temperature_unit=${unitTemp}&wind_speed_unit=${unitWind}&timezone=auto`;

        let message = Soup.Message.new('GET', url);
        _httpSession.send_and_read_async(message, 0, null, (session, result) => {
            try {
                let bytes = session.send_and_read_finish(result);
                let decoder = new TextDecoder('utf-8');
                let raw = JSON.parse(decoder.decode(bytes.toArray()));
                
                let cur = raw.current;
                let day = raw.daily;

                let isDay = cur.is_day === 1; 
                let curIcon = this.wmoToIcon(cur.weather_code, isDay);

                let unified = {
                    current: {
                        temp: Math.round(cur.temperature_2m),
                        feels: Math.round(cur.apparent_temperature),
                        desc: this.wmoToDesc(cur.weather_code),
                        icon: curIcon, 
                        hum: cur.relative_humidity_2m,
                        wind: Math.round(cur.wind_speed_10m),
                        windDeg: cur.wind_direction_10m,
                        uv: Math.round(day.uv_index_max[0]),
                        sunrise: (new Date(day.sunrise[0])).getTime() / 1000,
                        sunset: (new Date(day.sunset[0])).getTime() / 1000
                    },
                    today: {
                        max: Math.round(day.temperature_2m_max[0]),
                        min: Math.round(day.temperature_2m_min[0]),
                        pop: day.precipitation_probability_max[0],
                        moonPhase: 0.5, 
                        moonRise: 0
                    },
                    alerts: null, 
                    daily: [],
                    hourly: []
                };

                // Map Daily
                for(let i=0; i<day.time.length; i++) {
                    unified.daily.push({
                        dt: (new Date(day.time[i])).getTime() / 1000,
                        tempMax: Math.round(day.temperature_2m_max[i]),
                        tempMin: Math.round(day.temperature_2m_min[i]),
                        pop: day.precipitation_probability_max[i],
                        icon: this.wmoToIcon(day.weather_code[i], true),
                        wind: Math.round(day.wind_speed_10m_max[i])
                    });
                }
                // Map Hourly
                for(let i=0; i<24; i++) { 
                    unified.hourly.push({
                        dt: (new Date(raw.hourly.time[i])).getTime() / 1000,
                        temp: Math.round(raw.hourly.temperature_2m[i]),
                        pop: raw.hourly.precipitation_probability[i],
                        icon: this.wmoToIcon(raw.hourly.weather_code[i], true),
                        wind: Math.round(raw.hourly.wind_speed_10m[i])
                    });
                }

                // this.lastJson = unified;
                // this.updateUI(unified);
                if (onSuccess) {
                    onSuccess(unified);
                }

            } catch (e) { global.logError("Meteo Error: " + e); }
        });
    }

        wmoToIcon(code, isDay) {
        let suffix = isDay ? "d" : "n";
        if (code === 0) return "01" + suffix;
        if (code === 1) return "02" + suffix;
        if (code === 2) return "03" + suffix;
        if (code === 3) return "04" + suffix;
        if (code === 45 || code === 48) return "50" + suffix;
        if (code >= 51 && code <= 55) return "09" + suffix;
        if (code >= 61 && code <= 65) return "10" + suffix;
        if (code >= 71 && code <= 77) return "13" + suffix;
        if (code >= 80 && code <= 82) return "09" + suffix;
        if (code >= 95 && code <= 99) return "11" + suffix;
        return "01" + suffix; 
    }

    wmoToDesc(code) {
        let map = {
            0: "Clear sky", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
            45: "Fog", 48: "Depositing rime fog",
            51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
            61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
            71: "Slight snow", 73: "Moderate snow", 75: "Heavy snow",
            80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
            95: "Thunderstorm", 96: "Thunderstorm with slight hail", 99: "Thunderstorm with heavy hail"
        };
        return map[code] || "Unknown";
    }
}