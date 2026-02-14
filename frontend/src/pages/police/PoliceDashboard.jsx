import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Marker, Popup, useMap, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { supabase } from "../../lib/supabase"; 
import { Navigation, MapPin, CheckCircle, ArrowLeft, Phone, User, Siren } from "lucide-react";

// --- ICONS ---
const createUnitIcon = () => L.divIcon({
  className: "custom-unit-icon",
  html: `<div class="relative flex items-center justify-center w-6 h-6">
           <div class="absolute w-full h-full bg-blue-500/30 rounded-full animate-ping"></div>
           <div class="relative w-4 h-4 bg-blue-600 border-2 border-white rounded-full shadow-md"></div>
         </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 12]
});

const createIncidentIcon = (priority) => L.divIcon({
  className: "custom-incident-icon",
  html: `<div class="relative w-8 h-8 flex flex-col items-center justify-center">
            <div class="w-6 h-6 ${priority === 'critical' ? 'bg-red-600' : 'bg-orange-500'} rounded-full border-2 border-white shadow-lg flex items-center justify-center text-white">
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>
            </div>
            <div class="w-0.5 h-3 ${priority === 'critical' ? 'bg-red-600/50' : 'bg-orange-500/50'}"></div>
         </div>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40]
});

const MapUpdater = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => { map.flyTo(center, zoom, { duration: 1.2 }); }, [center, zoom, map]);
  return null;
};

const UNIT_LOCATION = { lat: 22.5726, lng: 88.3639 }; 

const isCoordLike = (s) => typeof s === 'string' && (s.includes('°') || s.includes('±') || /^\s*-?\d+(\.\d+)?\s*,\s*-?\d+(\.\d+)?\s*$/.test(s));
const reverseGeocodeAddress = async (lat, lng) => {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${lat}&lon=${lng}`,
      { headers: { 'User-Agent': 'NyayakApp/1.0', 'Accept-Language': 'en-IN, bn-IN;q=0.8, en;q=0.6' } });
    const data = await res.json();
    return data?.display_name || '';
  } catch (e) {
    console.warn('Reverse geocoding failed:', e);
    return '';
  }
};

const PoliceDashboard = () => {
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [mapCenter, setMapCenter] = useState([UNIT_LOCATION.lat, UNIT_LOCATION.lng]);
  const [zoomLevel, setZoomLevel] = useState(13);
  const [isResponding, setIsResponding] = useState(false);

  // --- DATA FETCHING ---
  useEffect(() => {
    const fetchLiveIncidents = async () => {
      const { data } = await supabase
        .from('emergencies')
        .select('*')
        .in('status', ['active', 'dispatching']) 
        .order('created_at', { ascending: false });
      if (data) setIncidents(data);
    };

    fetchLiveIncidents();

    const channel = supabase
      .channel('police_dashboard_map')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'emergencies' }, async (payload) => {
        fetchLiveIncidents();
        if (payload.eventType === 'INSERT') {
           toast.error(`🚨 NEW SOS: ${payload.new.topic || payload.new.type}`, { position: "top-right", theme: "colored", icon: <Siren className="animate-pulse" /> });
           const lat = Number(payload.new.location_lat);
           const lng = Number(payload.new.location_lng);
           if (!isNaN(lat) && !isNaN(lng)) {
             let addr = payload.new.location_address;
             if (!addr || isCoordLike(addr)) {
               addr = await reverseGeocodeAddress(lat, lng);
               try { await supabase.from('emergencies').update({ location_address: addr }).eq('id', payload.new.id); } catch {}
             }
             const enriched = { ...payload.new, location_address: addr };
             setSelectedIncident(enriched);
             setMapCenter([lat, lng]);
             setZoomLevel(15);
             setIsResponding(payload.new.status === 'dispatching');
           }
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSelect = async (incident) => {
    setSelectedIncident(incident);
    setMapCenter([incident.location_lat, incident.location_lng]);
    setZoomLevel(15);
    setIsResponding(incident.status === 'dispatching');

    // Ensure detailed address is shown
    if (!incident.location_address || isCoordLike(incident.location_address)) {
      const addr = await reverseGeocodeAddress(incident.location_lat, incident.location_lng);
      if (addr) {
        setSelectedIncident(prev => prev ? { ...prev, location_address: addr } : { ...incident, location_address: addr });
        try { await supabase.from('emergencies').update({ location_address: addr }).eq('id', incident.id); } catch {}
      }
    }
  };

  const handleRespond = async () => {
    if (!selectedIncident) return;
    setIsResponding(true);
    toast.info("Dispatch Unit En Route!", { icon: <Navigation className="animate-spin" /> });
    await supabase.from('emergencies').update({ status: 'dispatching' }).eq('id', selectedIncident.id);
    
    // Zoom out to show route
    const midLat = (UNIT_LOCATION.lat + selectedIncident.location_lat) / 2;
    const midLng = (UNIT_LOCATION.lng + selectedIncident.location_lng) / 2;
    setMapCenter([midLat, midLng]);
    setZoomLevel(12);
  };

  const handleMarkSafe = async () => {
    if (!selectedIncident) return;
    if (window.confirm("Mark as Resolved and close ticket?")) {
        const { error } = await supabase.from('emergencies').update({ status: 'resolved' }).eq('id', selectedIncident.id);
        
        if (!error) {
            toast.success("Incident Resolved");
            // Redirect to reports page as requested
            navigate('/police/reports'); 
        }
    }
  };

  return (
    <div className="h-full w-full flex flex-col lg:flex-row relative">
      <ToastContainer limit={3} />

      {/* MAP AREA */}
      <div className="flex-1 relative z-0">
         <MapContainer center={mapCenter} zoom={zoomLevel} style={{ height: "100%", width: "100%" }} zoomControl={false}>
            <TileLayer attribution='&copy; OpenStreetMap' url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
            <MapUpdater center={mapCenter} zoom={zoomLevel} />
            
            <Marker position={[UNIT_LOCATION.lat, UNIT_LOCATION.lng]} icon={createUnitIcon()}>
               <Popup><strong className="text-blue-700">UNIT 402</strong><br/>HQ Location</Popup>
            </Marker>

            {incidents.map((inc) => (
              <Marker 
                key={inc.id} 
                position={[inc.location_lat, inc.location_lng]} 
                icon={createIncidentIcon(inc.priority)}
                eventHandlers={{ click: () => handleSelect(inc) }}
              />
            ))}

            {selectedIncident && isResponding && (
                <Polyline 
                    positions={[[UNIT_LOCATION.lat, UNIT_LOCATION.lng], [selectedIncident.location_lat, selectedIncident.location_lng]]}
                    pathOptions={{ color: 'blue', weight: 4, opacity: 0.6, dashArray: '10, 10' }} 
                />
            )}
         </MapContainer>
         
         {/* Map Legend */}
         <div className="absolute top-4 left-4 z-[500] bg-white/90 backdrop-blur border border-slate-200 p-3 rounded-lg shadow-sm flex flex-col gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><div className="w-2.5 h-2.5 bg-blue-600 rounded-full border border-white shadow"></div>Your Unit</div>
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-600"><div className="w-2.5 h-2.5 bg-red-600 rounded-full border border-white shadow"></div>Active Incident</div>
         </div>
      </div>

      {/* DETAIL SIDEBAR (Overlaid or Side-by-side depending on screen) */}
      <div className="w-full lg:w-[400px] bg-white border-l border-slate-200 flex flex-col h-[50vh] lg:h-full overflow-hidden shadow-xl z-10">
        {!selectedIncident ? (
          /* LIST VIEW */
          <>
            <div className="p-5 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-slate-800">Dispatch Queue</h2>
                <p className="text-xs text-slate-500 font-medium mt-0.5">Live Feed • {incidents.length} Active</p>
              </div>
              <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
                <Siren className={`w-5 h-5 ${incidents.length > 0 ? 'text-red-500 animate-pulse' : 'text-slate-400'}`} />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#F8FAFC]">
              {incidents.length === 0 ? (
                 <div className="h-40 flex flex-col items-center justify-center text-slate-400 text-sm">
                    <CheckCircle className="w-8 h-8 mb-2 opacity-20" /> No Active Incidents
                 </div>
              ) : (
                incidents.map((incident) => (
                  <div key={incident.id} onClick={() => handleSelect(incident)} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex justify-between items-start mb-2">
                       <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded border ${incident.priority === 'critical' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-orange-500 text-orange-700 border-orange-100'}`}>{incident.priority}</span>
                       <span className="text-xs text-slate-400">{new Date(incident.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 group-hover:text-blue-600 transition-colors">{incident.topic || incident.type}</h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-2"><MapPin className="w-3 h-3" />{incident.location_address}</div>
                    {incident.status === 'dispatching' && <div className="mt-2 text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block">Units En Route</div>}
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          /* DETAIL VIEW */
          <>
            <div className="p-4 border-b border-slate-100 flex items-center gap-3 bg-slate-50">
              <button onClick={() => { setSelectedIncident(null); setIsResponding(false); setZoomLevel(13); }} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all border border-transparent hover:border-slate-200"><ArrowLeft className="w-5 h-5 text-slate-600" /></button>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wide">Incident Details</span>
            </div>
            <div className="flex-1 overflow-y-auto p-6 bg-white">
               <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-4 capitalize">{selectedIncident.topic || selectedIncident.type}</h1>
               
               {isResponding && (
                    <div className="mb-6 p-3 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-3 animate-in slide-in-from-top-2">
                         <div className="relative">
                            <span className="absolute top-0 right-0 -mr-1 -mt-1 w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
                            <Navigation className="w-5 h-5 text-blue-600" />
                         </div>
                         <div>
                             <div className="text-sm font-bold text-blue-800">Dispatching Units</div>
                             <div className="text-xs text-blue-600">Route plotted on map</div>
                         </div>
                    </div>
               )}

               <div className="space-y-6">
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Location</label>
                   <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                     <MapPin className="w-5 h-5 text-slate-400 mt-0.5" />
                     <div>
                       <div className="text-sm font-bold text-slate-800">{selectedIncident.location_address}</div>
                       <div className="text-xs text-slate-500 mt-1 font-mono">{selectedIncident.location_lat.toFixed(4)}, {selectedIncident.location_lng.toFixed(4)}</div>
                     </div>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                   <div>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Caller</label>
                     <div className="text-sm font-bold text-slate-700 mt-1 flex items-center gap-2"><User className="w-4 h-4" /> {selectedIncident.reporter_name}</div>
                   </div>
                   <div>
                     <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Phone</label>
                     <div className="text-sm font-bold text-slate-700 mt-1 flex items-center gap-2"><Phone className="w-4 h-4" /> {selectedIncident.reporter_phone}</div>
                   </div>
                 </div>
                 <div className="space-y-1">
                   <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">Description</label>
                   <p className="text-sm text-slate-600 leading-relaxed p-3 bg-white border border-slate-100 rounded-lg shadow-sm">{selectedIncident.description}</p>
                 </div>
               </div>
            </div>
            
            <div className="p-5 border-t border-slate-100 bg-white space-y-3">
              {!isResponding ? (
                  <button onClick={handleRespond} className="w-full py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-slate-900/10">
                    <Navigation className="w-4 h-4" /> Respond & Track
                  </button>
              ) : (
                  <div className="flex gap-3">
                      <button className="flex-1 py-3 bg-slate-100 text-slate-500 font-bold rounded-xl cursor-not-allowed flex items-center justify-center gap-2" disabled>
                        <Navigation className="w-4 h-4 animate-pulse" /> En Route...
                      </button>
                      <button onClick={handleMarkSafe} className="flex-1 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-green-600/20">
                         <CheckCircle className="w-4 h-4" /> Mark Safe
                      </button>
                  </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PoliceDashboard;