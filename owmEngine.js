const Soup = imports.gi.Soup;

var _httpSession;
if (typeof _httpSession === 'undefined') {
    _httpSession = new Soup.Session();
}

var OwmEngine = class OwmEngine {
    // --- OPEN WEATHER MAP ---
    fetchOWM(apiKey, location, units, onSuccess) {
        if (!apiKey) return;
        let lat = location.split(",")[0].trim();
        let lon = location.split(",")[1].trim();

        let url = `https://api.openweathermap.org/data/3.0/onecall?lat=${lat}&lon=${lon}&units=${units}&exclude=minutely&appid=${apiKey}`;
        
        let message = Soup.Message.new('GET', url);
        _httpSession.send_and_read_async(message, 0, null, (session, result) => {
            try {
                let bytes = session.send_and_read_finish(result);
                let decoder = new TextDecoder('utf-8');
                let raw = JSON.parse(decoder.decode(bytes.toArray()));
                
                // NORMALIZE DATA
                let unified = {
                    current: {
                        temp: Math.round(raw.current.temp),
                        feels: Math.round(raw.current.feels_like),
                        desc: raw.current.weather[0].description,
                        icon: raw.current.weather[0].icon, // "01d"
                        hum: raw.current.humidity,
                        wind: Math.round(raw.current.wind_speed),
                        windDeg: raw.current.wind_deg,
                        uv: Math.round(raw.current.uvi),
                        sunrise: raw.current.sunrise,
                        sunset: raw.current.sunset
                    },
                    today: {
                        max: Math.round(raw.daily[0].temp.max),
                        min: Math.round(raw.daily[0].temp.min),
                        pop: Math.round(raw.daily[0].pop * 100),
                        moonPhase: raw.daily[0].moon_phase,
                        moonRise: raw.daily[0].moonrise
                    },
                    alerts: (raw.alerts && raw.alerts.length > 0) ? raw.alerts[0].event : null,
                    daily: [],
                    hourly: []
                };

                // Map Daily
                for(let d of raw.daily) {
                    unified.daily.push({
                        dt: d.dt,
                        tempMax: Math.round(d.temp.max),
                        tempMin: Math.round(d.temp.min),
                        pop: Math.round(d.pop * 100),
                        icon: d.weather[0].icon,
                        wind: Math.round(d.wind_speed)
                    });
                }
                // Map Hourly
                for(let h of raw.hourly) {
                    unified.hourly.push({
                        dt: h.dt,
                        temp: Math.round(h.temp),
                        pop: Math.round(h.pop * 100),
                        icon: h.weather[0].icon,
                        wind: Math.round(h.wind_speed)
                    });
                }

                if (onSuccess) {
                    onSuccess(unified);
                }

            } catch (e) { global.logError("OWM Error: " + e); }
        });
    }
}
