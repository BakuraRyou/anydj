export const MOVING_MOODS=Object.freeze({
  balanced:{name:'Ausgewogen',help:'Abgestimmte Formationen mit deutlichen Akzenten.',span:1,speed:1,spacing:0,travel:0,tempo:1},
  calm:{name:'Ruhig',help:'Kleine Bewegungen, langsame Übergänge und längere Haltephasen.',span:.45,speed:.35,spacing:2.5,travel:1.8,tempo:.5},
  atmospheric:{name:'Atmosphärisch',help:'Weite, sanfte Lichtflächen mit seltenen Formationswechseln.',span:.85,speed:.45,spacing:4,travel:3,tempo:.35},
  energetic:{name:'Energiegeladen',help:'Größere Figuren und häufigere Wechsel auf musikalischen Akzenten.',span:1.2,speed:1,spacing:0,travel:0,tempo:1},
});
export const movingMood=value=>Object.hasOwn(MOVING_MOODS,value)?value:'balanced';
