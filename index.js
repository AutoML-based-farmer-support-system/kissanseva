var express = require('express');
var app = express();
var fs = require('fs');
const path = require('path');
var bodyParser = require('body-parser')
var axios = require('axios');
const session = require('express-session')
const cookieParser = require('cookie-parser');
var s = app.listen(1254);

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs')
app.set('views', path.join(__dirname, 'views'));
app.use(bodyParser.json());
var urlencodedParser = bodyParser.urlencoded({ extended: false })
const mysql = require('mysql')
const con = mysql.createConnection({
  connectionLimit: 100,
  host: 'localhost',//'cpdb1.cjlyu7lpn9hv.ap-south-1.rds.amazonaws.com',
  port: 3306,
  user: 'root',
  password: '',// 'sDFPjqEsvWnhSqGg3Ch5',
  database: 'kisanseva'
})
con.connect(function (err) {
  if (err) throw err;
  console.log("Connected!");
});


app.get('/', function (request, response) {
  console.log("Get home");
  sis = request.session;
  response.render('index')
});
app.get('/forgot-password', (request, response) => {
  console.log("Open forgot password")
  response.render("forgot-password")
})
const toIndianCurrency = (num) => {
  const curr = num.toLocaleString('en-IN', {
    style: 'currency',
    currency: 'INR'
  });
  return curr;
};
app.get('/register', async (request, response) => {
  console.log("Open register")
  await con.query("select distinct(state) from locationcommodity order by state asc", (err, rres) => {
    console.log("state list " + rres)
    response.render("register", { states: rres })
  })

})
app.get('/getdistricts', urlencodedParser, async (req, res) => {
  console.log("Get district from state" + req.query.state);
  const state = req.query.state;
  await con.query("select distinct(district) from locationcommodity where state=? order by district asc", [state], (err, rres) => {
    console.log("district list " + rres)
    res.json(rres)
  })
})

app.get('/getmarkets', urlencodedParser, async (req, res) => {
  console.log("Get markets from district" + req.query.district);
  const district = req.query.district;
  await con.query("select distinct(market) from locationcommodity where district=? order by market asc", [district], (err, rres) => {
    console.log("markets list " + rres)
    res.json(rres)
  })
})
app.post('/registerfarmer', urlencodedParser, async (req, res) => {
  console.log("Received post data " + req.body['first_name']);
  const firstName = req.body['first_name'];
  const lastName = req.body['last_name']
  const email = req.body['email']
  const mobile = req.body['mobile']
  const aadhar = req.body['aadhar']
  const land = req.body['land']
  const dob = req.body['dob']
  const state = req.body['state']
  const district = req.body['district']
  const market = req.body['market']
  const password = req.body['password']
  await con.query("insert into login values(?,?,?,?,?,?,?,?)", [email, firstName, lastName, mobile, aadhar, dob, password, "farmer"], async (err, data1) => {
    if (err) {
      res.render("index", { err: "Duplicate registration not allowed" })

    }
    else {
      await con.query("insert into farmerdata values(?,?,?,?,?,?)", [email, land, state, district, market, "1"], async (err, data1) => {
        res.render("index", { suc: "Registration successful" })
      })
    }
  })
})
app.get("/dmanagerhome", (req, res) => {
  res.render("dmanager-main")
})
app.get("/mkmanagerhome", (req, res) => {
  res.render("mkmanager-main")
})
app.post('/authuser', urlencodedParser, async (req, res) => {
  console.log("Received post data " + req.body['email']);
  const email = req.body['email']
  const password = req.body['password']
  await con.query("select * from login where email=? and password=?", [email, password], async (err, data) => {
    if (data.length == 1) {
      var role = data[0].role;
      var email = data[0].email;
      var firstname = data[0].firstname;
      var lastname = data[0].lastname;
      var mobile = data[0].mobile;
      var aadhar = data[0].aadhar;
      res.cookie("role", role);
      res.cookie("email", email);
      res.cookie("name", firstname + " " + lastname);
      res.cookie("mobile", mobile);
      res.cookie("aadhar", aadhar);
      if (role == "farmer") {
        await con.query("select * from farmerdata where email=? ", [email], async (err, data1) => {
          res.cookie("land", data1[0].land);
          res.cookie("state", data1[0].state);
          res.cookie("district", data1[0].district);
          res.cookie("market", data1[0].market);
          res.cookie("status", data1[0].status);
          const status = data1[0].status;
          if (status == "1") {
            res.render('farmer-stage1', { name: firstname })
          }
          else {
            await con.query("SELECT a.longi,a.lati,a.minprice,a.maxprice,a.yield,o.* FROM  farmerdata f,openai o, automl a  where o.crop=f.status and a.crop=f.status and f.email=? order by question", [email], async (err, f) => {

              var config = {
                method: 'get',
                maxBodyLength: Infinity,
                url: 'https://api.openweathermap.org/data/2.5/forecast?appid=b280765d6c89c0d63e2881b9135cfcb6&lat=' + f[0].lati + '&lon=' + f[0].longi + '&units=metric',
                headers: {}
              };

              axios(config)
                .then(function (response) {
                  console.log(JSON.stringify(response.data));
                  const result = JSON.parse(JSON.stringify(response.data))
                  weatherdataArray = []


                  for (var i = 0; i < 7; i++) {
                    var myDate = new Date(result.list[i].dt * 1000);
                    const weatherdatabasic = {
                      dt: myDate.toLocaleString(),
                      temp: result.list[i].main.temp,
                      weather: result.list[i].weather[0].description,
                      icon: result.list[i].weather[0].icon,
                      wind: result.list[i].wind.speed,
                      cloud: result.list[i].clouds.all,
                      humidity: result.list[i].main.humidity,
                    }
                    weatherdataArray.push(weatherdatabasic);

                  }
                  res.render('farmer-stage2', { wd: weatherdataArray, place: result.city.name, rc: toIndianCurrency, q1: f[0].answer, q2: f[1].answer, q3: f[2].answer, q4: f[3].answer, q5: f[4].answer, land: req.cookies.land, crop: f[0].crop, yield: f[0].yield, minprice: f[0].minprice, maxprice: f[0].maxprice })

                })
                .catch(function (error) {
                  console.log(error);
                });
            })
          }
        }
        )
      }
      else if (role == "dmanager") {
        res.render("dmanager-main");
      }
      else if (role == "mkmanager") {
        res.render("mkmanager-main")
      }
      else if (role == "company") {
        await con.query("select * from companyinfo where email=? ", [email], async (err, data) => {
          if (data.length == 1 && data[0].status == "approved") {
            res.render("companyhome");
          }
          else  if (data.length == 1 && data[0].status == "reject") {
            res.render("index", { err: "Admin rejected your application." })
          }
          else {
            res.render("index", { err: "Admin approval pending." })
          }
        })
      }

    }
    else {
      res.render("index", { err: "Invalid login details." })
    }
  })
})
app.post("/registercompany", urlencodedParser, async (req, res) => {
  const companyname = req.body['companyname'];
  const email = req.body['email'];
  const aadhar = req.body['aadhar'];
  const mobile = req.body['mobile'];
  const gstn = req.body['gstn'];
  const desc = req.body['desc'];
  const dob = req.body['dob'];
  const cset1 = req.body['cset1'];
  const password = req.body['password'];
  await con.query("insert into login values(?,?,?,?,?,?,?,?)", [email, companyname, companyname, mobile, aadhar, dob, password, "company"], async (err, data1) => {
    if (err) {
      res.render("index", { err: "Duplicate registration not allowed" })

    }
    else {
      await con.query("insert into companyinfo values(?,?,?,?,?,?,?)", [companyname, email, gstn, desc, dob, cset1, "pending"], async (err, data1) => {
        res.render("index", { suc: "Registration successful. Please wait for admin approval." })
      })
    }
  })
})
app.get("/registercompany", async (req, res) => {
  await con.query("select distinct(commodity) from locationcommodity  order by commodity asc", (err, rres) => {

    res.render("registercompany", { cset: rres })
  })

})
app.post("/viewcropinfo", urlencodedParser, (req, res) => {
  const cropname = req.body['cropname'];

  var data = JSON.stringify({
    "ma": [
      [
        req.cookies.state,
        req.cookies.district,
        cropname
      ]
    ]
  });

  var config = {
    method: 'get',
    maxBodyLength: Infinity,
    url: 'http://127.0.0.1:5000/predict-yield',
    headers: {
      'Content-Type': 'application/json'
    },
    data: data
  };

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
      const yield = response.data.predicteddata[1];
      var minvaluedata = JSON.stringify({
        "ma": [
          [
            cropname,
            req.cookies.state,
            req.cookies.district,
            req.cookies.market

          ]
        ]
      });

      var config = {
        method: 'get',
        maxBodyLength: Infinity,
        url: 'http://127.0.0.1:5000/predict-minprice',
        headers: {
          'Content-Type': 'application/json'
        },
        data: minvaluedata
      };

      axios(config)
        .then(function (response) {
          console.log(JSON.stringify(response.data));
          const minprice = response.data.predicteddata[1];
          var maxd = JSON.stringify({
            "ma": [
              [
                cropname,
                req.cookies.state,
                req.cookies.district,
                req.cookies.market
              ]
            ]
          });

          var config = {
            method: 'get',
            maxBodyLength: Infinity,
            url: 'http://127.0.0.1:5000/predict-maxprice',
            headers: {
              'Content-Type': 'application/json'
            },
            data: maxd
          };

          axios(config)
            .then(async function (response) {
              console.log(JSON.stringify(response.data));
              const maxprice = response.data.predicteddata[1];
              console.log("yield" + yield + "minprice" + minprice + "maxprice" + maxprice)
              await con.query("select * from openai where crop=? order by question ", [cropname], async (err, f) => {
                if (f.length == 0) {
                  var config = {
                    method: 'get',
                    maxBodyLength: Infinity,
                    url: 'http://localhost:4521/getopenaiinfo?q=how to cultivate ' + cropname + ' in india?',
                    headers: {}
                  };

                  axios(config)
                    .then(async function (response) {
                      console.log(JSON.stringify(response.data));
                      await con.query("insert into openai values(?,?,?)  ", [cropname, "q1", response.data.reply], async (err, f1) => {
                        var config = {
                          method: 'get',
                          maxBodyLength: Infinity,
                          url: 'http://localhost:4521/getopenaiinfo?q=Risk involved in cultivation of ' + cropname + ' in india?',
                          headers: {}
                        };

                        axios(config)
                          .then(async function (response) {
                            console.log(JSON.stringify(response.data));
                            await con.query("insert into openai values(?,?,?)  ", [cropname, "q2", response.data.reply], async (err, f2) => {
                              var config = {
                                method: 'get',
                                maxBodyLength: Infinity,
                                url: 'http://localhost:4521/getopenaiinfo?q=Expenditure to cultivate ' + cropname + ' in india?',
                                headers: {}
                              };

                              axios(config)
                                .then(async function (response) {
                                  console.log(JSON.stringify(response.data));
                                  await con.query("insert into openai values(?,?,?)  ", [cropname, "q3", response.data.reply], async (err, f3) => {
                                    var config = {
                                      method: 'get',
                                      maxBodyLength: Infinity,
                                      url: 'http://localhost:4521/getopenaiinfo?q=Resources required to cultivate ' + cropname + ' in india?',
                                      headers: {}
                                    };

                                    axios(config)
                                      .then(async function (response) {
                                        console.log(JSON.stringify(response.data));
                                        await con.query("insert into openai values(?,?,?)  ", [cropname, "q4", response.data.reply], async (err, f4) => {
                                          var config = {
                                            method: 'get',
                                            maxBodyLength: Infinity,
                                            url: 'http://localhost:4521/getopenaiinfo?q=Future demand for ' + cropname + ' crop in india?',
                                            headers: {}
                                          };

                                          axios(config)
                                            .then(async function (response) {
                                              console.log(JSON.stringify(response.data));
                                              await con.query("insert into openai values(?,?,?)  ", [cropname, "q5", response.data.reply], async (err, f5) => {
                                                await con.query("select * from openai where crop=? order by question ", [cropname], async (err, qf) => {
                                                  res.render('viewcropinfo', { rc: toIndianCurrency, q1: qf[0].answer, q2: qf[1].answer, q3: qf[2].answer, q4: qf[3].answer, q5: qf[4].answer, land: req.cookies.land, crop: cropname, yield: yield, minprice: minprice, maxprice: maxprice })

                                                })

                                              })
                                            })
                                            .catch(function (error) {
                                              console.log(error);
                                            });

                                        })
                                      })
                                      .catch(function (error) {
                                        console.log(error);
                                      });

                                  })
                                })
                                .catch(function (error) {
                                  console.log(error);
                                });

                            })

                          })
                          .catch(function (error) {
                            console.log(error);
                          });

                      })
                    })
                    .catch(function (error) {
                      console.log(error);
                    });

                }
                else {
                  res.render('viewcropinfo', { rc: toIndianCurrency, q1: f[0].answer, q2: f[1].answer, q3: f[2].answer, q4: f[3].answer, q5: f[4].answer, land: req.cookies.land, crop: cropname, yield: yield, minprice: minprice, maxprice: maxprice })
                }

              })



            })
            .catch(function (error) {
              console.log(error);
            });

        })
        .catch(function (error) {
          console.log(error);
        });


    })
    .catch(function (error) {
      console.log(error);
    });


})
app.get("/get_crops", urlencodedParser, async (req, res) => {
  await con.query("SELECT DISTINCT(commodity) FROM `locationcommodity` WHERE state=? order by commodity", [req.cookies.state], async (err, data2) => {
    res.json(data2)
  })

})

app.get("/loadstage1", (req, res) => {
  res.render('farmer-stage1', { name: req.cookies.name })
})
app.get("/loadstage2", urlencodedParser, async (req, res) => {
  await con.query("SELECT a.longi,a.lati,a.minprice,a.maxprice,a.yield,o.* FROM  farmerdata f,openai o, automl a  where o.crop=f.status and a.crop=f.status and f.email=? order by question", [req.cookies.email], async (err, f) => {

    var config = {
      method: 'get',
      maxBodyLength: Infinity,
      url: 'https://api.openweathermap.org/data/2.5/forecast?appid=b280765d6c89c0d63e2881b9135cfcb6&lat=' + f[0].lati + '&lon=' + f[0].longi + '&units=metric',
      headers: {}
    };

    axios(config)
      .then(function (response) {
        console.log(JSON.stringify(response.data));
        const result = JSON.parse(JSON.stringify(response.data))
        weatherdataArray = []


        for (var i = 0; i < 7; i++) {
          var myDate = new Date(result.list[i].dt * 1000);
          const weatherdatabasic = {
            dt: myDate.toLocaleString(),
            temp: result.list[i].main.temp,
            weather: result.list[i].weather[0].description,
            icon: result.list[i].weather[0].icon,
            wind: result.list[i].wind.speed,
            cloud: result.list[i].clouds.all,
            humidity: result.list[i].main.humidity,
          }
          weatherdataArray.push(weatherdatabasic);

        }
        res.render('farmer-stage2', { wd: weatherdataArray, place: result.city.name, rc: toIndianCurrency, q1: f[0].answer, q2: f[1].answer, q3: f[2].answer, q4: f[3].answer, q5: f[4].answer, land: req.cookies.land, crop: f[0].crop, yield: f[0].yield, minprice: f[0].minprice, maxprice: f[0].maxprice })

      })
      .catch(function (error) {
        console.log(error);
      });
  })
})
app.get("/planthealth", urlencodedParser, async (req, res) => {
  res.render("plant-health")

})
app.post("/registercrop", urlencodedParser, async (req, res) => {
  const cropname = req.body['crop'];
  const minprice = req.body['minprice'];
  const maxprice = req.body['maxprice'];
  const yield = req.body['yield'];
  const lati = req.body['lati'];
  const longi = req.body['longi'];
  await con.query("update farmerdata set status=? where email=?", [cropname, req.cookies.email], async (err, data2) => {
    await con.query("insert into automl values(?,?,?,?,?,?,?)", [req.cookies.email, minprice, maxprice, yield, cropname, longi, lati], async (err, data2) => {
      await con.query("SELECT a.longi,a.lati,a.minprice,a.maxprice,a.yield,o.* FROM  farmerdata f,openai o, automl a  where o.crop=f.status and a.crop=f.status and f.email=? order by question", [req.cookies.email], async (err, f) => {

        var config = {
          method: 'get',
          maxBodyLength: Infinity,
          url: 'https://api.openweathermap.org/data/2.5/forecast?appid=b280765d6c89c0d63e2881b9135cfcb6&lat=' + f[0].lati + '&lon=' + f[0].longi + '&units=metric',
          headers: {}
        };

        axios(config)
          .then(function (response) {
            console.log(JSON.stringify(response.data));
            const result = JSON.parse(JSON.stringify(response.data))
            weatherdataArray = []


            for (var i = 0; i < 7; i++) {
              var myDate = new Date(result.list[i].dt * 1000);
              const weatherdatabasic = {
                dt: myDate.toLocaleString(),
                temp: result.list[i].main.temp,
                weather: result.list[i].weather[0].description,
                icon: result.list[i].weather[0].icon,
                wind: result.list[i].wind.speed,
                cloud: result.list[i].clouds.all,
                humidity: result.list[i].main.humidity,
              }
              weatherdataArray.push(weatherdatabasic);

            }
            res.render('farmer-stage2', { wd: weatherdataArray, place: result.city.name, rc: toIndianCurrency, q1: f[0].answer, q2: f[1].answer, q3: f[2].answer, q4: f[3].answer, q5: f[4].answer, land: req.cookies.land, crop: f[0].crop, yield: f[0].yield, minprice: f[0].minprice, maxprice: f[0].maxprice })

          })
          .catch(function (error) {
            console.log(error);
          });
      })
    })
  })
})
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));
app.post("/checkplant", urlencodedParser, async (req, res) => {
  const image = []
  image.push(req.body['img']);
  console.log(image)

  const data = {
    api_key: "VNUFspuZd1hIW2ED6i3g2aNDJFyDPx8rLcx2pq4XOWTW9YPJBO",
    images: image,

    modifiers: ["crops_fast"],
    language: "en",


  };

  var config = {
    method: 'post',
    maxBodyLength: Infinity,
    url: 'https://api.plant.id/v2/health_assessment',
    headers: {
      'Content-Type': 'application/json'
    },
    data: data
  };

  axios(config)
    .then(function (response) {
      console.log(JSON.stringify(response.data));
      var health = JSON.parse(JSON.stringify(response.data));
      const tosend = {
        isgood: health.health_assessment.is_healthy,
        disease: health.health_assessment.diseases[0].name
      }
      res.json(tosend)
    })
    .catch(function (error) {
      console.log(error);
    });

})

app.get("/loadstage3", (req, res) => {

  res.render('farmer-stage3', { name: req.cookies.name })
})

app.get("/sellorder", (req, res) => {
  res.render("sellorder")

})
app.post("/sellorder", urlencodedParser, async (req, res) => {
  const address = req.body['address'];
  const qa = req.body['qa'];
  const { randomUUID } = require('crypto'); 
  const oid=randomUUID();
console.log("Order ID is "+oid);
  await con.query("insert into orders values(?,?,?,?,?,?,?,?,?,?)", [oid,req.cookies.email, req.cookies.name, req.cookies.mobile, address, req.cookies.status, qa, "NA", "NA", "NA"], async (err, data1) => {
    res.render('farmer-stage3', { name: req.cookies.name })
  })

})
app.get("/myorders", async (req, res) => {
  await con.query("SELECT * FROM `orders` WHERE farmeremail=?", [req.cookies.email], async (err, data2) => {
    res.json(data2)
  })
})

app.get("/managecompany", async (req, res) => {

  res.render("managecompany")
})
app.get("/getcompanies", async (req, res) => {
  await con.query("SELECT * FROM `companyinfo`  ", async (err, data2) => {
    res.json(data2)
  })
})
app.post("/approve",urlencodedParser,async(req,res)=>{
  const cname=req.body['company'];
  await con.query("update companyinfo set status=? where name=?",["approved",cname], async (err, data2) => {
    res.render("managecompany")
  })
})
app.post("/reject",urlencodedParser,async(req,res)=>{
  const cname=req.body['company'];
  await con.query("update companyinfo set status=? where name=?",["reject",cname], async (err, data2) => {
    res.render("managecompany")
  })
})
app.get("/companyhome",(req,res)=>{
  res.render("companyhome")
})
app.get("/acporders",async(req,res)=>{
  await con.query("select * from orders where reservedby=? or reservedby=?",[req.cookies.email,"NA"], async (err, data2) => {
    res.json(data2)
  })


})

app.post("/reserve",urlencodedParser,async(req,res)=>{
  await con.query("update orders set finalprice=?,status=?,reservedby=? where orderid=?",[req.body['finalprice'],req.body['status'],req.cookies.email,req.body['oid']], async (err, data2) => {
    res.render("companyhome")
  })
})
app.post("/viewcinfo",urlencodedParser,async(req,res)=>{
  await con.query("select * from companyinfo where email=? ",[req.body['company']], async (err, data2) => {
    res.json(data2[0])
  })
})