/* Seed-plan activities surfaced into the suggestions DB (from data.js, with coords). */
window.SEED_RECS_SEED = {
  Tokyo: {
    todo: [
      { name: "Kitanomaru Park", type: "park", area: "Chiyoda", price: "free", rating: 4.3, booking: "Free", lat: 35.6919, lng: 139.7522, mapsQuery: "Kitanomaru Park Tokyo", why: "Green space adjacent to the palace." },
      { name: "teamLab Planets", type: "experience", area: "Toyosu", price: "$$", rating: 4.5, booking: "Booked", lat: 35.6493, lng: 139.7906, mapsQuery: "teamLab Planets Tokyo", why: "BOOKED timed entry. Immersive digital + water art; huge with kids." },
      { name: "Odaiba + DiverCity (Gundam statue)", type: "experience", area: "Odaiba", price: "free", rating: 4.4, booking: "Free", lat: 35.6256, lng: 139.7756, mapsQuery: "Odaiba + DiverCity (Gundam statue) Tokyo", why: "Waterfront, life-size Gundam, malls." },
      { name: "Senso-ji Temple + Nakamise St", type: "sight", area: "Asakusa", price: "free", rating: 4.5, booking: "Free walk-in", lat: 35.7148, lng: 139.7967, mapsQuery: "Senso-ji Temple + Nakamise St Tokyo", why: "Historic temple; shopping street snacks." },
      { name: "Tokyo Skytree", type: "sight", area: "Sumida", price: "$", rating: 4.4, booking: "Advance e-ticket cheaper", lat: 35.7101, lng: 139.8107, mapsQuery: "Tokyo Skytree Tokyo", why: "Observation deck; Sumida Aquarium + Pokémon Center in complex." },
    ],
    food: [
      { name: "Marunouchi / Tokyo Station dinner", type: "food", area: "Marunouchi", price: "$$", rating: 4.5, booking: "Walk-in", lat: 35.6812, lng: 139.7671, mapsQuery: "Marunouchi / Tokyo Station dinner Tokyo", why: "Lots of family dining around the station." },
      { name: "Toyosu Market", type: "food", area: "Toyosu", price: "$$", rating: 4.3, booking: "Walk-in", lat: 35.6452, lng: 139.7866, mapsQuery: "Toyosu Market Tokyo", why: "Sushi breakfast near teamLab before the noon slot." },
    ],
  },
  Osaka: {
    todo: [
      { name: "Osaka Castle", type: "sight", area: "Chuo", price: "$", rating: 4.4, booking: "Ticket at door/online", lat: 34.6873, lng: 135.5259, mapsQuery: "Osaka Castle Osaka", why: "Climb the tower; park grounds, optional moat boat." },
    ],
    food: [
      { name: "Dōtonbori (Glico sign)", type: "food", area: "Namba", price: "$$", rating: 4.5, booking: "Walk-in", lat: 34.6687, lng: 135.5013, mapsQuery: "Dōtonbori (Glico sign) Osaka", why: "Iconic neon, street food, takoyaki." },
      { name: "Universal CityWalk", type: "food", area: "Universal City", price: "$$", rating: 4.2, booking: "Walk-in", lat: 34.6667, lng: 135.4356, mapsQuery: "Universal CityWalk Osaka", why: "Dinner by the park exit." },
    ],
  },
  Seoul: {
    todo: [
      { name: "Gyeongbokgung Palace", type: "sight", area: "Jongno", price: "free", rating: 4.6, booking: "₩3,000 / free in hanbok", lat: 37.5796, lng: 126.977, mapsQuery: "Gyeongbokgung Palace Seoul", why: "Changing of Guard 10am & 2pm (not Tue). Free entry in hanbok." },
      { name: "Lotte World", type: "experience", area: "Songpa", price: "$$", rating: 4.4, booking: "Buy online", lat: 37.5111, lng: 127.098, mapsQuery: "Lotte World Seoul", why: "70% indoor theme park. Buy online (foreigner discount + Magic Pass)." },
      { name: "Seoul Sky (Lotte World Tower)", type: "sight", area: "Songpa", price: "$", rating: 4.5, booking: "Ticket online", lat: 37.5125, lng: 127.1025, mapsQuery: "Seoul Sky (Lotte World Tower) Seoul", why: "Observation deck above the park; aquarium + mall in complex." },
    ],
    food: [
      { name: "Myeongdong street food", type: "food", area: "Jung-gu", price: "$$", rating: 4.3, booking: "Walk-in", lat: 37.5636, lng: 126.9869, mapsQuery: "Myeongdong street food Seoul", why: "Night market eats; nearby Namdaemun + Myeongdong Cathedral." },
      { name: "Insadong", type: "shopping", area: "Jongno", price: "$$", rating: 4.4, booking: "Walk-in", lat: 37.574, lng: 126.9849, mapsQuery: "Insadong Seoul", why: "Crafts, tea houses, family dining." },
    ],
  },
  Beijing: {
    todo: [
      { name: "Great Wall — Mutianyu", type: "sight", area: "Huairou", price: "$", rating: 4.7, booking: "Transport + lift ticket", lat: 40.4319, lng: 116.5704, mapsQuery: "Great Wall — Mutianyu Beijing", why: "~1.5 hrs each way. Private car/driver or Klook shared van. Chairlift up + toboggan down combo ¥140. Full day." },
      { name: "Forbidden City", type: "sight", area: "Dongcheng", price: "$", rating: 4.7, booking: "Passport reservation", lat: 39.9163, lng: 116.3972, mapsQuery: "Forbidden City Beijing", why: "Passport reservation opens 7 days ahead (Jun 23, 8pm Beijing). Morning session. Open Tue (closed Mondays)." },
      { name: "Kunming Lake dragon-boat cruise", type: "experience", area: "Haidian", price: "$$", rating: 4.5, booking: "On the day", lat: 39.9925, lng: 116.2722, mapsQuery: "Kunming Lake dragon-boat cruise Beijing", why: "On-site boat across the lake." },
      { name: "Houhai / hutong rickshaw", type: "experience", area: "Xicheng", price: "$$", rating: 4.4, booking: "Walk-in / book rickshaw", lat: 39.94, lng: 116.3839, mapsQuery: "Houhai / hutong rickshaw Beijing", why: "Old alleys, lakeside dining. Relaxed last evening." },
    ],
    food: [
      { name: "Wangfujing walking street", type: "shopping", area: "Dongcheng", price: "$$", rating: 4.1, booking: "Walk-in", lat: 39.9149, lng: 116.4109, mapsQuery: "Wangfujing walking street Beijing", why: "Steps from hotel; snack street, Tiananmen lit up nearby." },
    ],
  },
};
(function(){var R=window.SEED_RECS,E=window.SEED_RECS_SEED;if(!R||!E)return;for(var c in E){if(!R[c])R[c]={todo:[],food:[]};["todo","food"].forEach(function(k){var seen=new Set((R[c][k]||[]).map(function(o){return (o.name||"").toLowerCase();}));(E[c][k]||[]).forEach(function(o){var key=(o.name||"").toLowerCase();if(!seen.has(key)){R[c][k].push(o);seen.add(key);}});});}})();
