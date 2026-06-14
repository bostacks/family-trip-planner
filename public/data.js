// Seed itinerary. Loaded into localStorage on first run; user edits persist after.
window.SEED_TRIP = {
  title: "Asia Trip 2026",
  party: "2 adults + kids 12, 10, 7",
  hotels: {
    Tokyo: { name: "Mimaru Suites Tokyo Nihombashi", lat: 35.6839, lng: 139.7744 },
    Osaka: { name: "Imperial Hotel Osaka", lat: 34.7065, lng: 135.5158 },
    Seoul: { name: "Uh Suite The Seoul (211 Mallijae-ro, Jung-gu)", lat: 37.5569, lng: 126.9636 },
    Beijing: { name: "Grand Hyatt Beijing (Wangfujing)", lat: 39.9087, lng: 116.4109 },
  },
  days: [
    {
      id: "d0618", date: "2026-06-18", weekday: "Thu", city: "Transit",
      blocks: [
        { slot: "evening", items: [
          { name: "Depart Vancouver YVR 4:45pm — Flight NH115", type: "transit", rating: null, lat: 49.1947, lng: -123.1792, area: "YVR", notes: "Overnight flight to Tokyo Haneda. Crosses date line.", booking: "Booked", locked: true },
        ]},
      ],
    },
    {
      id: "d0619", date: "2026-06-19", weekday: "Fri", city: "Tokyo",
      blocks: [
        { slot: "evening", items: [
          { name: "Arrive Tokyo Haneda (HND) 7:00pm", type: "transit", rating: null, lat: 35.5494, lng: 139.7798, area: "HND", notes: "Customs, train/taxi to hotel, dinner near Nihombashi, sleep. No sightseeing.", booking: "—", locked: true },
        ]},
      ],
    },
    {
      id: "d0620", date: "2026-06-20", weekday: "Sat", city: "Tokyo",
      blocks: [
        { slot: "morning", items: [
          { name: "Imperial Palace East Gardens", type: "sight", rating: 4.4, lat: 35.6852, lng: 139.7528, area: "Chiyoda", notes: "Gentle, central — good jet-lag day. Closed Mon/Fri; Sat is fine.", booking: "Free walk-in", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Kitanomaru Park", type: "park", rating: 4.3, lat: 35.6919, lng: 139.7522, area: "Chiyoda", notes: "Green space adjacent to the palace.", booking: "Free", locked: false },
        ]},
        { slot: "evening", items: [
          { name: "Marunouchi / Tokyo Station dinner", type: "food", rating: 4.5, lat: 35.6812, lng: 139.7671, area: "Marunouchi", notes: "Lots of family dining around the station.", booking: "Walk-in", locked: false },
        ]},
      ],
    },
    {
      id: "d0621", date: "2026-06-21", weekday: "Sun", city: "Tokyo",
      blocks: [
        { slot: "morning", items: [
          { name: "Toyosu Market", type: "food", rating: 4.3, lat: 35.6452, lng: 139.7866, area: "Toyosu", notes: "Sushi breakfast near teamLab before the noon slot.", booking: "Walk-in", locked: false },
        ]},
        { slot: "lunch", items: [
          { name: "teamLab Planets — entry 12:00–12:30", type: "experience", rating: 4.5, lat: 35.6493, lng: 139.7906, area: "Toyosu", notes: "BOOKED timed entry. Immersive digital + water art; huge with kids.", booking: "Booked", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Odaiba + DiverCity (Gundam statue)", type: "experience", rating: 4.4, lat: 35.6256, lng: 139.7756, area: "Odaiba", notes: "Waterfront, life-size Gundam, malls.", booking: "Free", locked: false },
        ]},
      ],
    },
    {
      id: "d0622", date: "2026-06-22", weekday: "Mon", city: "Tokyo",
      blocks: [
        { slot: "morning", items: [
          { name: "Senso-ji Temple + Nakamise St", type: "sight", rating: 4.5, lat: 35.7148, lng: 139.7967, area: "Asakusa", notes: "Historic temple; shopping street snacks.", booking: "Free walk-in", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Tokyo Skytree", type: "sight", rating: 4.4, lat: 35.7101, lng: 139.8107, area: "Sumida", notes: "Observation deck; Sumida Aquarium + Pokémon Center in complex.", booking: "Advance e-ticket cheaper", locked: true },
        ]},
      ],
    },
    {
      id: "d0623", date: "2026-06-23", weekday: "Tue", city: "Osaka",
      blocks: [
        { slot: "morning", items: [
          { name: "Shinkansen Tokyo → Osaka", type: "transit", rating: null, lat: 34.7335, lng: 135.5003, area: "Shin-Osaka", notes: "~2.5 hrs. Reserve seats (SmartEX/Klook).", booking: "Reserve seats", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Osaka Castle", type: "sight", rating: 4.4, lat: 34.6873, lng: 135.5259, area: "Chuo", notes: "Climb the tower; park grounds, optional moat boat.", booking: "Ticket at door/online", locked: true },
        ]},
        { slot: "evening", items: [
          { name: "Dōtonbori (Glico sign)", type: "food", rating: 4.5, lat: 34.6687, lng: 135.5013, area: "Namba", notes: "Iconic neon, street food, takoyaki.", booking: "Walk-in", locked: false },
        ]},
      ],
    },
    {
      id: "d0624", date: "2026-06-24", weekday: "Wed", city: "Osaka",
      blocks: [
        { slot: "morning", items: [
          { name: "Universal Studios Japan", type: "experience", rating: 4.6, lat: 34.6654, lng: 135.4323, area: "Konohana", notes: "Full day. Super Nintendo World + Harry Potter. BUY STUDIO PASS + EXPRESS PASS ONLINE NOW — no gate sales.", booking: "Buy online ASAP", locked: true },
        ]},
        { slot: "evening", items: [
          { name: "Universal CityWalk", type: "food", rating: 4.2, lat: 34.6667, lng: 135.4356, area: "Universal City", notes: "Dinner by the park exit.", booking: "Walk-in", locked: false },
        ]},
      ],
    },
    {
      id: "d0625", date: "2026-06-25", weekday: "Thu", city: "Seoul",
      blocks: [
        { slot: "afternoon", items: [
          { name: "Fly Osaka → Seoul", type: "transit", rating: null, lat: 37.4602, lng: 126.4407, area: "ICN", notes: "Check in, settle. Light arrival day.", booking: "Flight", locked: true },
        ]},
        { slot: "evening", items: [
          { name: "Myeongdong street food", type: "food", rating: 4.3, lat: 37.5636, lng: 126.9869, area: "Jung-gu", notes: "Night market eats; nearby Namdaemun + Myeongdong Cathedral.", booking: "Walk-in", locked: false },
        ]},
      ],
    },
    {
      id: "d0626", date: "2026-06-26", weekday: "Fri", city: "Seoul",
      blocks: [
        { slot: "morning", items: [
          { name: "Gyeongbokgung Palace", type: "sight", rating: 4.6, lat: 37.5796, lng: 126.9770, area: "Jongno", notes: "Changing of Guard 10am & 2pm (not Tue). Free entry in hanbok.", booking: "₩3,000 / free in hanbok", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Bukchon Hanok Village", type: "sight", rating: 4.3, lat: 37.5826, lng: 126.9830, area: "Jongno", notes: "Traditional hanok lanes; photo spots.", booking: "Free", locked: false },
        ]},
        { slot: "evening", items: [
          { name: "Insadong", type: "shopping", rating: 4.4, lat: 37.5740, lng: 126.9849, area: "Jongno", notes: "Crafts, tea houses, family dining.", booking: "Walk-in", locked: false },
        ]},
      ],
    },
    {
      id: "d0627", date: "2026-06-27", weekday: "Sat", city: "Seoul",
      blocks: [
        { slot: "morning", items: [
          { name: "Lotte World", type: "experience", rating: 4.4, lat: 37.5111, lng: 127.0980, area: "Songpa", notes: "70% indoor theme park. Buy online (foreigner discount + Magic Pass).", booking: "Buy online", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Seoul Sky (Lotte World Tower)", type: "sight", rating: 4.5, lat: 37.5125, lng: 127.1025, area: "Songpa", notes: "Observation deck above the park; aquarium + mall in complex.", booking: "Ticket online", locked: false },
        ]},
      ],
    },
    {
      id: "d0628", date: "2026-06-28", weekday: "Sun", city: "Beijing",
      blocks: [
        { slot: "afternoon", items: [
          { name: "Fly Seoul → Beijing", type: "transit", rating: null, lat: 40.0799, lng: 116.6031, area: "PEK", notes: "Allow time for immigration. Check in at Grand Hyatt.", booking: "Flight", locked: true },
        ]},
        { slot: "evening", items: [
          { name: "Wangfujing walking street", type: "shopping", rating: 4.1, lat: 39.9149, lng: 116.4109, area: "Dongcheng", notes: "Steps from hotel; snack street, Tiananmen lit up nearby.", booking: "Walk-in", locked: false },
        ]},
      ],
    },
    {
      id: "d0629", date: "2026-06-29", weekday: "Mon", city: "Beijing",
      blocks: [
        { slot: "morning", items: [
          { name: "Great Wall — Mutianyu", type: "sight", rating: 4.7, lat: 40.4319, lng: 116.5704, area: "Huairou", notes: "~1.5 hrs each way. Private car/driver or Klook shared van. Chairlift up + toboggan down combo ¥140. Full day.", booking: "Transport + lift ticket", locked: true },
        ]},
      ],
    },
    {
      id: "d0630", date: "2026-06-30", weekday: "Tue", city: "Beijing",
      blocks: [
        { slot: "morning", items: [
          { name: "Forbidden City", type: "sight", rating: 4.7, lat: 39.9163, lng: 116.3972, area: "Dongcheng", notes: "Passport reservation opens 7 days ahead (Jun 23, 8pm Beijing). Morning session. Open Tue (closed Mondays).", booking: "Passport reservation", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Jingshan Park viewpoint", type: "park", rating: 4.6, lat: 39.9281, lng: 116.3906, area: "Dongcheng", notes: "Rooftop view over the Forbidden City. Across the north exit.", booking: "Small fee", locked: false },
        ]},
        { slot: "evening", items: [
          { name: "Tiananmen Square", type: "sight", rating: 4.5, lat: 39.9055, lng: 116.3976, area: "Dongcheng", notes: "Vast square; ID needed to enter.", booking: "Free (ID)", locked: false },
        ]},
      ],
    },
    {
      id: "d0701", date: "2026-07-01", weekday: "Wed", city: "Beijing",
      blocks: [
        { slot: "morning", items: [
          { name: "Summer Palace", type: "sight", rating: 4.6, lat: 39.9999, lng: 116.2755, area: "Haidian", notes: "Passport reservation opens 7 days ahead (Jun 24). Lakeside imperial gardens.", booking: "Passport reservation", locked: true },
        ]},
        { slot: "afternoon", items: [
          { name: "Kunming Lake dragon-boat cruise", type: "experience", rating: 4.5, lat: 39.9925, lng: 116.2722, area: "Haidian", notes: "On-site boat across the lake.", booking: "On the day", locked: false },
        ]},
        { slot: "evening", items: [
          { name: "Houhai / hutong rickshaw", type: "experience", rating: 4.4, lat: 39.9400, lng: 116.3839, area: "Xicheng", notes: "Old alleys, lakeside dining. Relaxed last evening.", booking: "Walk-in / book rickshaw", locked: false },
        ]},
      ],
    },
    {
      id: "d0702", date: "2026-07-02", weekday: "Thu", city: "Transit",
      blocks: [
        { slot: "morning", items: [
          { name: "Depart Beijing", type: "transit", rating: null, lat: 40.0799, lng: 116.6031, area: "PEK", notes: "Fly home.", booking: "Flight", locked: true },
        ]},
      ],
    },
  ],
};
