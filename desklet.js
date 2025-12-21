const Desklet = imports.ui.desklet;
const St = imports.gi.St;
const Settings = imports.ui.settings;
const Mainloop = imports.mainloop;
const Lang = imports.lang;
const Soup = imports.gi.Soup;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;

var _httpSession;
if (typeof _httpSession === 'undefined') {
    _httpSession = new Soup.Session();
}

function main(metadata, desklet_id) {
    return new OpenWeatherDesklet(metadata, desklet_id);
}

class OpenWeatherDesklet extends Desklet.Desklet {
    constructor(metadata, desklet_id) {
        super(metadata, desklet_id);

        this.lastJson = null; 
        this.window = null; 

        this.settings = new Settings.DeskletSettings(this, this.metadata.uuid, desklet_id);
        
        this.settings.bind("apiProvider", "apiProvider", this.onSettingChanged.bind(this));
        this.settings.bind("apiKey", "apiKey", this.onSettingChanged.bind(this));
        this.settings.bind("location", "location", this.onSettingChanged.bind(this));
        this.settings.bind("locationLabel", "locationLabel", this.onSettingChanged.bind(this));
        this.settings.bind("units", "units", this.onSettingChanged.bind(this));
        this.settings.bind("refreshInterval", "refreshInterval", this.onSettingChanged.bind(this));
        this.settings.bind("deskletLayout", "deskletLayout", this.onSettingChanged.bind(this));
        this.settings.bind("transparency", "transparency", this.onSettingChanged.bind(this));
        this.settings.bind("iconSource", "iconSource", this.onSettingChanged.bind(this));
        this.settings.bind("iconSet", "iconSet", this.onSettingChanged.bind(this));
        this.settings.bind("forecastMode", "forecastMode", this.onSettingChanged.bind(this));
        this.settings.bind("forecastItems", "forecastItems", this.onSettingChanged.bind(this));

        this.setupUI();
        this.onSettingChanged(); 
    }

    onSettingChanged() {
        if (this.timeout) Mainloop.source_remove(this.timeout);
        this.setupUI(); 

        if (!this.location) {
            this.showError("Location Needed");
            return;
        }
        if (this.apiProvider === "owm" && !this.apiKey) {
            this.showError("API Key Needed");
            return;
        }

        if (this.locationLabel) {
            this.updateCityLabel(this.locationLabel);
        } else {
            if(this.apiProvider === "owm") this.getCityNameOWM();
            else this.updateCityLabel("Open-Meteo");
        }

        this.refreshWeather();
        
        let interval = (this.refreshInterval < 10) ? 600 : (this.refreshInterval * 60);
        this.timeout = Mainloop.timeout_add_seconds(interval, Lang.bind(this, this.refreshWeather));
    }

    setupUI() {
        let isVertical = (this.deskletLayout === "vertical");

        if (!this.window) {
            this.window = new St.BoxLayout({
                style_class: "weather-main",
                style: "border-radius: 12px; padding: 10px;" 
            });
            this.setContent(this.window);
        }
        this.window.set_style(`background-color: rgba(0,0,0,${this.transparency}); border-radius: 12px; padding: 10px;`);
        this.window.destroy_all_children();
        this.window.set_vertical(isVertical);

        // --- CURRENT ---
        this.panelCurrent = new St.BoxLayout({ vertical: true, style: "min-width: 170px; padding: 5px; text-align: center;" });
        
        this.btnCity = new St.Button({ style: "padding: 0px; border: none; background-color: transparent;", reactive: true });
        this.lblCity = new St.Label({ text: "Loading...", style: "font-weight: bold; font-size: 1.1em; color: #fff;" });
        this.btnCity.set_child(this.lblCity);
        this.btnCity.connect('clicked', Lang.bind(this, this.openUrl));
        this.panelCurrent.add(this.btnCity);

        this.lblDesc = new St.Label({ text: "...", style: "font-size: 0.8em; color: #ccc; margin-bottom: 5px;" });
        this.panelCurrent.add(this.lblDesc);

        this.lblAlert = new St.Label({ text: "", style: "color: #ffcccc; background-color: #aa0000; border-radius: 4px; padding: 2px 4px; font-size: 0.8em; font-weight: bold; margin-bottom: 5px;" });

        this.centerBin = new St.Bin({ x_align: St.Align.MIDDLE });
        this.centerBox = new St.BoxLayout({ vertical: false });
        this.iconBin = new St.Bin({ style: "height: 85px;", y_align: St.Align.MIDDLE });
        this.lblTemp = new St.Label({ text: "--°", style: "font-size: 2.8em; font-weight: 300; color: #fff; padding-left: 10px;" });
        let tempMiddlewareBin = new St.Bin({ y_align: St.Align.MIDDLE, child: this.lblTemp });
        this.centerBox.add(this.iconBin);
        this.centerBox.add(tempMiddlewareBin);
        this.centerBin.set_child(this.centerBox);
        this.panelCurrent.add(this.centerBin);

        this.lblFeels = new St.Label({ text: "", style: "font-size: 0.85em; color: #ddd; margin-bottom: 8px;" });
        this.panelCurrent.add(this.lblFeels);

        this.panelDetails = new St.BoxLayout({ vertical: true });
        this.lblDetail1 = new St.Label({ text: "", style: "font-size: 0.75em; color: #ccc;" }); 
        this.lblDetail2 = new St.Label({ text: "", style: "font-size: 0.75em; color: #ccc;" }); 
        this.panelCurrent.add(this.panelDetails);
        this.panelDetails.add(this.lblDetail1);
        this.panelDetails.add(this.lblDetail2);

        this.window.add(this.panelCurrent);

        // --- FORECAST ---
        this.panelForecastContainer = new St.BoxLayout({
            vertical: true,
            style: isVertical ? "margin-top: 5px;" : "margin-left: 10px; border-left: 1px solid rgba(255,255,255,0.1); padding-left: 10px; min-width: 200px;"
        });

        let btnLabel = (this.forecastMode === "hourly") ? "Show Daily Forecast" : "Show Hourly Forecast";
        this.btnToggle = new St.Button({
            label: btnLabel,
            style: "width: 100%; padding: 4px; margin-bottom: 5px; background-color: rgba(255,255,255,0.15); color: #ddd; border-radius: 4px; font-size: 0.8em; border: 1px solid rgba(255,255,255,0.1);",
            reactive: true
        });
        this.btnToggle.connect('clicked', Lang.bind(this, this.toggleForecastMode));
        this.panelForecastContainer.add(this.btnToggle);

        this.panelForecast = new St.BoxLayout({ vertical: true, style: "border-top: 1px solid rgba(255,255,255,0.1); padding-top: 5px;" });
        this.panelForecastContainer.add(this.panelForecast);

        this.lblUpdated = new St.Label({ text: "Updated: --:--", style: "color: #666; font-size: 0.7em; margin-top: 5px; text-align: center;" });
        this.panelForecastContainer.add(this.lblUpdated);

        this.window.add(this.panelForecastContainer);
    }

    // --- DATA ROUTER ---
    refreshWeather() {
        if (!this.location) return;

        if (this.apiProvider === "owm") {
            this.fetchOWM();
        } else {
            this.fetchMeteo();
        }
        return true;
    }

    // --- OPEN WEATHER MAP ---
    fetchOWM() {
        if (!this.apiKey) return;
        let latlon = this.location.split(",");
        let url = `https://api.openweathermap.org/data/3.0/onecall?lat=${latlon[0]}&lon=${latlon[1]}&units=${this.units}&exclude=minutely&appid=${this.apiKey}`;
        
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

                this.lastJson = unified;
                this.updateUI(unified);

            } catch (e) { global.logError("OWM Error: " + e); }
        });
    }

    // --- OPEN-METEO (FREE) ---
    fetchMeteo() {
        let latlon = this.location.split(",");
        let lat = latlon[0].trim();
        let lon = latlon[1].trim();
        
        let unitTemp = (this.units === "imperial") ? "fahrenheit" : "celsius";
        let unitWind = (this.units === "imperial") ? "mph" : "ms";

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

                this.lastJson = unified;
                this.updateUI(unified);

            } catch (e) { global.logError("Meteo Error: " + e); }
        });
    }

    // --- HELPERS & SHARED UI ---
    
    // RESTORED FUNCTION
    updateCityLabel(name) { 
        if(this.lblCity) this.lblCity.set_text(name); 
    }
    
    showError(msg) { if(this.lblCity) this.lblCity.set_text(msg); }

    updateUI(data) {
        if (!data) return;

        // Alerts
        if (data.alerts) {
            this.lblAlert.set_text(`⚠ ${data.alerts}`);
            if (!this.lblAlert.get_parent()) this.panelCurrent.insert_child_at_index(this.lblAlert, 2);
        } else {
            if (this.lblAlert.get_parent()) this.panelCurrent.remove_child(this.lblAlert);
        }

        // Current
        this.lblTemp.set_text(data.current.temp + "°");
        this.lblFeels.set_text(`H:${data.today.max}° / L:${data.today.min}°  |  Feels ${data.current.feels}°`);
        
        let desc = data.current.desc;
        this.lblDesc.set_text(desc.charAt(0).toUpperCase() + desc.slice(1));
        this.loadIcon(data.current.icon, this.iconBin, 85);

        // Details
        let windUnit = (this.units === "imperial") ? "mph" : "m/s";
        let windDir = this.getWindDir(data.current.windDeg);
        
        let moonStr = (this.apiProvider === "owm") ? this.getMoonSymbol(data.today.moonPhase) : "";

        let sunRise = this.formatTime(data.current.sunrise);
        let sunSet = this.formatTime(data.current.sunset);
        let moonRise = (data.today.moonRise) ? this.formatTime(data.today.moonRise) : "";

        this.lblDetail1.set_text(`💧 ${data.today.pop}%  |  Hum: ${data.current.hum}%  |  💨 ${windDir} @ ${data.current.wind}${windUnit}`);
        
        let astroStr = `☀️ ${sunRise}-${sunSet}`;
        if (data.current.uv > 0) astroStr += `  |  UV:${data.current.uv}`;
        if (moonStr !== "") astroStr += `  |  ${moonStr} ${moonRise}`;
        this.lblDetail2.set_text(astroStr);

        // Forecast
        this.panelForecast.destroy_all_children();
        let list = (this.forecastMode === "hourly") ? data.hourly : data.daily;
        let startIndex = (this.forecastMode === "hourly") ? 0 : 1;
        let btnLabel = (this.forecastMode === "hourly") ? "Show Daily Forecast" : "Show Hourly Forecast";
        this.btnToggle.set_label(btnLabel);

        let count = 0;
        for (let i = startIndex; i < list.length; i++) {
            if (count >= this.forecastItems) break;
            let item = list[i];
            
            let row = new St.BoxLayout({ style: "margin-bottom: 4px; padding-bottom: 4px; border-bottom: 1px solid rgba(255,255,255,0.05);" });
            
            let dateObj = new Date(item.dt * 1000);
            let timeLabelStr = (this.forecastMode === "hourly") 
                ? dateObj.getHours() + ":00" 
                : dateObj.toLocaleDateString("en-US", { weekday: 'short' });
            row.add(new St.Label({ text: timeLabelStr, style: "width: 45px; font-weight: bold; color: #ddd;" }));

            let iconBox = new St.Bin({ style: "width: 40px;" });
            this.loadIcon(item.icon, iconBox, 24);
            row.add(iconBox);

            let tempStr = (this.forecastMode === "hourly") 
                ? Math.round(item.temp) + "°" 
                : Math.round(item.tempMax) + "°/" + Math.round(item.tempMin) + "°";
            row.add(new St.Label({ text: tempStr, style: "width: 65px; text-align: right; color: #fff;" }));

            let popColor = (item.pop > 0) ? "#88ccff" : "#ffffff";
            row.add(new St.Label({ text: `💧${item.pop}%`, style: `width: 50px; text-align: right; color: ${popColor}; font-size: 0.85em;` }));

            row.add(new St.Label({ text: `💨${item.wind}`, style: "width: 40px; text-align: right; color: #ccc; font-size: 0.85em;" }));

            this.panelForecast.add(row);
            count++;
        }

        // Footer
        let now = new Date();
        let hours = now.getHours();
        let mins = now.getMinutes();
        let ampm = hours >= 12 ? 'pm' : 'am';
        hours = hours % 12; hours = hours ? hours : 12; 
        mins = mins < 10 ? '0'+mins : mins;
        this.lblUpdated.set_text(`Updated: ${hours}:${mins} ${ampm} (${this.apiProvider === "owm" ? "OWM" : "Meteo"})`);
    }

    // --- UTILITIES ---
    getCityNameOWM() {
        let latlon = this.location.split(",");
        let url = `http://api.openweathermap.org/geo/1.0/reverse?lat=${latlon[0]}&lon=${latlon[1]}&limit=1&appid=${this.apiKey}`;
        let message = Soup.Message.new('GET', url);
        _httpSession.send_and_read_async(message, 0, null, (session, result) => {
            try {
                let bytes = session.send_and_read_finish(result);
                let decoder = new TextDecoder('utf-8');
                let json = JSON.parse(decoder.decode(bytes.toArray()));
                if (json && json.length > 0) this.updateCityLabel(json[0].name);
            } catch (e) {}
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

    formatTime(unix) {
        if (!unix) return "--:--";
        let d = new Date(unix * 1000);
        let min = d.getMinutes();
        return d.getHours() + ":" + (min < 10 ? "0"+min : min);
    }
    
    getWindDir(deg) {
        const directions = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
        return directions[Math.round(deg / 45) % 8];
    }
    
    getMoonSymbol(phase) {
        if (phase === 0 || phase === 1) return "🌑";
        if (phase < 0.25) return "🌒";
        if (phase === 0.25) return "🌓";
        if (phase < 0.5) return "🌔";
        if (phase === 0.5) return "🌕";
        if (phase < 0.75) return "🌖";
        if (phase === 0.75) return "🌗";
        return "🌘";
    }

    loadIcon(code, container, size) {
        if (this.iconSource === "online") {
            let url = `https://openweathermap.org/img/wn/${code}@2x.png`;
            let texture = St.TextureCache.get_default().load_uri_async(url, size, size);
            container.set_child(texture);
            return;
        }
        let map = { "01d": "32.png", "01n": "31.png", "02d": "34.png", "02n": "33.png", "03d": "30.png", "03n": "29.png", "04d": "28.png", "04n": "27.png", "09d": "12.png", "09n": "12.png", "10d": "39.png", "10n": "45.png", "11d": "4.png",  "11n": "4.png",  "13d": "16.png", "13n": "16.png", "50d": "20.png", "50n": "20.png" };
        let folder = this.iconSet || "vclouds";
        let filename = map[code];
        if (!filename && (code === "04d" || code === "04n")) filename = "26.png";
        let path = `${this.metadata.path}/icons/${folder}/${filename}`;
        let file = Gio.File.new_for_path(path);
        if (!file.query_exists(null)) {
            path = `${this.metadata.path}/icons/${folder}/${code}.png`;
            file = Gio.File.new_for_path(path);
        }
        if (file.query_exists(null)) {
            let texture = St.TextureCache.get_default().load_file_async(file, -1, size, 1, 1.0);
            container.set_child(texture);
        } else container.set_child(null);
    }
    
    toggleForecastMode() {
        this.forecastMode = (this.forecastMode === "hourly") ? "daily" : "hourly";
        let btnLabel = (this.forecastMode === "hourly") ? "Show Daily Forecast" : "Show Hourly Forecast";
        this.btnToggle.set_label(btnLabel);
        if (this.lastJson) this.updateUI(this.lastJson); 
        this.settings.set_string("forecastMode", this.forecastMode);
    }

    openUrl() {
        let latlon = this.location.split(",");
        let url = `https://openweathermap.org/weathermap?basemap=map&cities=true&layer=temperature&lat=${latlon[0]}&lon=${latlon[1]}&zoom=10`;
        Gio.app_info_launch_default_for_uri(url, null);
    }
}