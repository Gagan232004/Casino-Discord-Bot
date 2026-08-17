export const CRICKETER_CATEGORIES = {
  indian_batsmen: [
    "Virat Kohli", "Rohit Sharma", "Sachin Tendulkar", "Shubman Gill", "Suryakumar Yadav",
    "Shreyas Iyer", "Cheteshwar Pujara", "Ajinkya Rahane", "Virender Sehwag", "Sourav Ganguly",
    "Rahul Dravid", "VVS Laxman", "Gautam Gambhir", "Shikhar Dhawan", "Yashasvi Jaiswal",
    "Ruturaj Gaikwad", "Prithvi Shaw", "Mayank Agarwal", "Manish Pandey", "Murali Vijay"
  ],
  indian_bowlers: [
    "Jasprit Bumrah", "Mohammed Shami", "Mohammed Siraj", "R Ashwin", "Yuzvendra Chahal",
    "Kuldeep Yadav", "Bhuvneshwar Kumar", "Zaheer Khan", "Ashish Nehra", "Harbhajan Singh",
    "Anil Kumble", "Javagal Srinath", "Ishant Sharma", "Umesh Yadav", "Arshdeep Singh",
    "Navdeep Saini", "Avesh Khan", "Deepak Chahar", "Shardul Thakur", "T Natarajan",
    "Amit Mishra", "Piyush Chawla", "Ravi Bishnoi", "Pragyan Ojha", "Munaf Patel"
  ],
  indian_wk_and_allrounders: [
    "MS Dhoni", "Rishabh Pant", "KL Rahul", "Sanju Samson", "Dinesh Karthik",
    "Ishan Kishan", "Hardik Pandya", "Ravindra Jadeja", "Yuvraj Singh", "Kapil Dev",
    "Washington Sundar", "Axar Patel", "Krunal Pandya", "Stuart Binny", "Irfan Pathan",
    "Yusuf Pathan", "Suresh Raina", "Kedar Jadhav", "Wriddhiman Saha", "Parthiv Patel"
  ],
  foreign_batsmen: [
    "Steve Smith", "David Warner", "Marnus Labuschagne", "Kane Williamson", "Joe Root",
    "Babar Azam", "AB de Villiers", "Chris Gayle", "Ricky Ponting", "Brian Lara",
    "Viv Richards", "Kevin Pietersen", "Hashim Amla", "Faf du Plessis", "Ross Taylor",
    "Kumar Sangakkara", "Mahela Jayawardene", "Sanath Jayasuriya", "Matthew Hayden", "Adam Gilchrist",
    "Jos Buttler", "Jonny Bairstow", "Quinton de Kock", "Mohammad Rizwan", "Glenn Maxwell"
  ],
  foreign_bowlers: [
    "Pat Cummins", "Mitchell Starc", "Josh Hazlewood", "Nathan Lyon", "Trent Boult",
    "Tim Southee", "Shaheen Afridi", "Rashid Khan", "Jofra Archer", "Mark Wood",
    "James Anderson", "Stuart Broad", "Dale Steyn", "Morne Morkel", "Kagiso Rabada",
    "Shane Warne", "Glenn McGrath", "Brett Lee", "Muttiah Muralitharan", "Lasith Malinga",
    "Wasim Akram", "Waqar Younis", "Shoaib Akhtar", "Curtly Ambrose", "Courtney Walsh"
  ]
};

export const ALL_CRICKETERS = Object.values(CRICKETER_CATEGORIES).flat();
