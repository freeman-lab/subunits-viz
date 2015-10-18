DataDB = new Meteor.Collection(null);

if(Meteor.isClient) {

  // get data to population menus from our d3 JSON parser

  function getFields() {
    console.log(DataDB.find().count())
    var unique_data_sets = unique(data.retina.map(function(d) {
      return d.data_set;
    }));
    Session.set("data_set", unique_data_sets[0])
    for(var i = 0; i < unique_data_sets.length; i++) {
      var unique_cell_types = unique(data.retina.filter(function(d) {
        return d.data_set == unique_data_sets[i]
      }).map(function(d) {
        return d.cell_type;
      }));
      var unique_fit_types = unique(data.retina.filter(function(d) {
        return d.data_set == unique_data_sets[i]
      }).map(function(d) {
        return d.fit_type;
      }));
      DataDB.insert({
        data_set: unique_data_sets[i],
        cell_types: unique_cell_types,
        fit_types: unique_fit_types
      })
      if(i === 0) {
        Session.set("cell_type", unique_cell_types[0])
        Session.set("fit_type", unique_fit_types[0])
      }
    };
  }

  // control data set menu
  Template.data_set_menu.data_sets = function() {
    return DataDB.find({}, {
      sort: {
        data_set: 1
      }
    });
  }

  Template.data_set_menu.selected = function() {
    return Session.equals("data_set", this.data_set) ? "active" : '';
  }

  Template.data_set_menu.events({
    'click .data_set_menu_item': function() {
      Session.set("data_set", this.data_set)
      Session.set("cell_type", DataDB.find({
        data_set: Session.get("data_set")
      }).fetch()[0].cell_types[0])
    }
  })

  // control cell type menu
  Template.cell_type_menu.cell_types = function() {
    var returnArray = new Array();
    var foo = DataDB.find({
      data_set: Session.get("data_set")
    }).map(function(d) {
      return d.cell_types
    })
    if(foo.length > 0) {
      foo = foo[0];
      for(var i = 0; i < foo.length; i++)
        returnArray[i] = {
          "cell_type": foo[i]
        };
      }
      return returnArray
    }

    Template.cell_type_menu.selected = function() {
      return Session.equals("cell_type", this.cell_type) ? "active" : '';
    }

    Template.cell_type_menu.events({
      'click .cell_type_menu_item': function() {
        Session.set("cell_type", this.cell_type)
      }
    })

  // control fit type menu
  Template.fit_type_menu.fit_types = function() {
    var returnArray = new Array();
    var foo = DataDB.find({
      data_set: Session.get("data_set")
    }).map(function(d) {
      return d.fit_types
    })
    if(foo.length > 0) {
      foo = foo[0];
      for(var i = 0; i < foo.length; i++)
        returnArray[i] = {
          "fit_type": foo[i]
        };
      }
      return returnArray
    }

    Template.fit_type_menu.selected = function() {
      return Session.equals("fit_type", this.fit_type) ? "active" : '';
    }

    Template.fit_type_menu.events({
      'click .fit_type_menu_item': function() {
        Session.set("fit_type", this.fit_type)
      }
    })

  // set session variables based on selections to ensure redraw
  Template.loaddata.fit_type = function() {
    return Session.get("fit_type")
  }
  Template.loaddata.cell_type = function() {
    return Session.get("cell_type")
  }
  Template.loaddata.data_set = function() {
    return Session.get("data_set")
  }
  Template.cell_count.num_cells = function() {
    return Session.get("num_cells")
  }

  // what to do on each render of the main plot 
  Template.loaddata.rendered = function() {

    // set up the main plot space
    var w = 745
    var h = 450
    var trans = [0, 0]
    var scale = 1;

    var svg1 = d3.select("#mainGraphContainer")
    .append("svg:svg")
    .attr("width", w)
    .attr("height", h)
    .attr("pointer-events", "all")
    .style("background-color", d3.rgb(80, 80, 80))
    .append('svg:g')
    .call(d3.behavior.zoom().translate([50, -50]).scale(1).on("zoom", redraw))
    .append('svg:g').attr("transform", "translate(" + [50, -50] + ")" + " scale(" + 1 + ")");

    svg1.append('svg:rect').attr('width', w).attr('height', h).attr('fill', d3.rgb(80, 80, 80))

    var coneSz = 2.25;
    var coneStroke = 0.5;
    var hullStroke = coneSz * 3.5;

    // set up our scales
    var x = d3.scale.linear().domain([75, 275]).range([0, 600]);

    var y = d3.scale.linear().domain([75, 275]).range([0, 600]);

    // what to do when translating and scaling

    function redraw() {
      console.log("here", d3.event.translate, d3.event.scale);
      trans = d3.event.translate;
      scale = d3.event.scale;
      svg1.attr("transform", "translate(" + trans + ")" + " scale(" + scale + ")");
    }

    // function for creating convex hulls

    function groupPath(d) {
      // if we only have one point, form a mini pair
      if(d.values.length == 1) return "M" + d.values.map(function(i) {
        return [[x(i.x) - 0.2, y(i.y) - 0.2], [x(i.x) + 0.2, y(i.y) + 0.2]];
      }).join("L") + "Z";
      // if we only have two points, just bind them
      if(d.values.length == 2) return "M" + d.values.map(function(i) {
        return [x(i.x), y(i.y)];
      }).join("L") + "Z";
      // otherwise, compute the convex hull
      return "M" + d3.geom.hull(d.values.map(function(i) {
        return [x(i.x), y(i.y)];
      })).join("L") + "Z";
    }

    // function for inverting mouse based on scales


    function scalepos(d) {
      var o
      o = [x.invert(d[0]), y.invert(d[1])];
      return o
    }

    var fit_type = Session.get("fit_type");
    var data_set = Session.get("data_set");
    var cell_type = Session.get("cell_type");

    function update() {

    // parse data structure to get links
    data.retina.forEach(function(d) {
      return d = getlinks(d);
    });

    // grab fit structure based on menu selections
    foo = data.retina.filter(function(d) {
      return d.cell_type == cell_type && d.fit_type == fit_type && d.data_set == data_set
    });
    fit = foo[0];

    Session.set("num_cells", fit.num_cells)

    // manually delete stuff so we can force redraw
    var links = svg1.selectAll("line.links")
    links.remove()
    var subs = svg1.selectAll("path.subs")
    subs.remove()
    var cones = svg1.selectAll("circle.cones")
    cones.remove()
    var cellCenters = svg1.selectAll("circle.cellcenters")
    cellCenters.remove()
    var remcones = svg1.selectAll("circle.remcones")
    remcones.remove()
    
    // set domains and ranges based on data
    x.domain([d3.min(fit.remCones,function(d) {return d.x}), d3.max(fit.remCones,function(d) {return d.x})]);
    y.domain([d3.min(fit.remCones,function(d) {return d.y}), d3.max(fit.remCones,function(d) {return d.y})]);
    
    // draw the background cones
    var remcones = svg1.selectAll("circle.remcones")
    .data(fit.remCones)
    remcones.enter().append("circle")
    .attr("class","remcones")
    .attr("cx", (function(d) {return x(d.x);}))
    .attr("cy", (function(d) {return y(d.y);}))
    .attr("r", coneSz/2)
    remcones.style("fill", "black");
    
    // draw a line for each link
    var links = svg1.selectAll("line.links")
    .data(fit.links)
    links.enter().append("line")
    .attr("class","links")
    links
    .attr("x1", function(d) { return x(d.source.x); })
    .attr("y1", function(d) { return y(d.source.y); })
    .attr("x2", function(d) { return x(d.target.x); })
    .attr("y2", function(d) { return y(d.target.y); })
    links.style("stroke", "white")
    .style("stroke-width", function(d) { return d.value*3; })
    .style("stroke-linecap", "round")
    links.exit().remove()
    
    // draw convex hulls around subunits
    var subs = svg1.selectAll("path.subs")
    .data(collapse(d3.nest()
      .key(function(d) {return d.cell_id; })
      .key(function(d) {return d.sub_id; })
      .entries(fit.cones)))
    subs.enter().append("path")
    .attr("class","subs")
    subs.style("fill", d3.rgb(150,150,150))
    .style("stroke", d3.rgb(150,150,150))
    .style("stroke-width", hullStroke)
    .style("stroke-linejoin", "round")
    .style("opacity", 0.9)
    .attr("d", groupPath)
    subs.exit().remove() 
    
    // draw the cones
    var cones = svg1.selectAll("circle.cones")
    .data(fit.cones)
    cones.enter().append("circle")
    .attr("class","cones")
    cones.attr("cx", (function(d) {return x(d.x);}))
    .attr("cy", (function(d) {return y(d.y);}))
    .attr("r", coneSz)
    .style("stroke", "black")
    .style("stroke-width", coneStroke)
    cones.style("fill", function(d) {return clrs(d.sub_count,d.cone_weight);});
    cones.exit().remove()
    
    // create the subunit centers
    // (this should really just collapse the cellCenter -> subCenter array)
    var subCenters = svg1.selectAll("circle.subcenters")
    .data(fit.subCenters)
    subCenters.enter().append("circle")
    .attr("class","subcenters")
    subCenters.attr("cx", (function(d) {return x(d.x);}))
    .attr("cy", (function(d) {return y(d.y);}))
    .attr("r", 0)

    // draw the cell centers as black dots
    var cellCenters = svg1.selectAll("circle.cellcenters")
    .data(fit.cellCenters)
    cellCenters.enter().append("circle")
    .attr("class","cellcenters")
    cellCenters.attr("cx", (function(d) {return x(d.x);}))
    .attr("cy", (function(d) {return y(d.y);}))
    .attr("r", 12)
    .style("fill", "white")
    .style("opacity",0)
       .on("mouseover",mover)
    .on("mouseout",mout)
    //.on("click", function(d) {displayDeets(d.rgc_id);})
    cellCenters.exit().remove()
    
    // clear nonlinearity plot
    d3.select("#nonLinContainer").selectAll("svg").remove()
    d3.select("#r2Container").selectAll("svg").remove()
    d3.select("#r2SelContainer").selectAll("svg").remove()

    if ((Session.equals("fit_type","greedy")) || (Session.equals("fit_type","LN"))) {

    // create nonlinearity plot space
    var margin = {top: 20, right: 20, bottom: 30, left: 40},
    w2 = 200 - margin.left - margin.right,
    h2 = 200 - margin.top - margin.bottom;

    var nonlinAll = d3.select("#nonLinContainer").append("svg")
    .attr("width", w2 + margin.left + margin.right)
    .attr("height", h2 + margin.top + margin.bottom)
    .append("g")
    .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // create scales
    var xNonLin = d3.scale.linear()
    .domain([-2.5,2.5])
    .range([0,w2]);

    var yNonLin = d3.scale.linear()
    .domain([-2.5,2.5])
    .range([h2,0]);

    var formatTicksNonLin = d3.format("d");

    // create axes
    var xAxis = d3.svg.axis()
    .scale(xNonLin)
    .tickFormat(formatTicksNonLin)
    .orient("bottom")
    .ticks(4);

    var yAxis = d3.svg.axis()
    .scale(yNonLin)
    .tickFormat(formatTicksNonLin)
    .orient("left")
    .ticks(3);

    // function for drawing lines
    var line = d3.svg.line()
    .x(function(d) {return xNonLin(d.x);})
    .y(function(d) {return yNonLin(d.y);})
    .interpolate("monotone"); 

    // reformat the nonlinear data for easier iteration
    var nonlins = new Array();
    for (var i = 0; i < fit.cellCenters.length; i++)
      {var nonlinssub = new Array();
        for (var j = 0; j < 8; j++)
          {nonlinssub.push({x: fit.cellCenters[i].f[j].x, y: fit.cellCenters[i].f[j].y})}
        nonlins.push(nonlinssub);}

        var path = nonlinAll.selectAll(".nonlin")
        .data(nonlins)
        .enter()
        .append("path")
        .attr("class","nonlin")
        .attr("d",line)

        nonlinAll.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + h2 + ")")
        .call(xAxis)
        .append("text")
        .attr("class", "label")
        .attr("x", w2)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("Subunit nonlinearity");

        nonlinAll.append("g")
        .attr("class", "axis")
        .call(yAxis)

        var margin = {top: 20, right: 20, bottom: 30, left: 40},
        w3 = 200 - margin.left - margin.right,
        h3 = 200 - margin.top - margin.bottom;

        var xr2 = d3.scale.linear()
        .range([0, w3])
        .domain([0, 0.5]);

        var yr2 = d3.scale.linear()
        .range([h3, 0])
        .domain([0, 0.5]);

        var formatTicksr2 = d3.format(".2g")

        var xAxis_r2 = d3.svg.axis()
        .scale(xr2)
        .tickFormat(formatTicksr2)
        .orient("bottom")
        .ticks(2);

        var yAxis_r2 = d3.svg.axis()
        .scale(yr2)
        .tickFormat(formatTicksr2)
        .orient("left")
        .ticks(2);

        var svg3 = d3.select("#r2Container").append("svg")
        .attr("width", w3 + margin.left + margin.right)
        .attr("height", h3 + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        svg3.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + h3 + ")")
        .call(xAxis_r2)
        .append("text")
        .attr("class", "label")
        .attr("x", w3)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("R2 LN");

        svg3.append("g")
        .attr("class", "axis")
        .call(yAxis_r2)
        .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("R2 Sub")

        svg3.selectAll(".dot")
        .data(fit.cellCenters)
        .enter().append("circle")
        .attr("class", "dot")
        .attr("r", 4)
        .attr("cx", function(d) { return xr2(d.r2_LN); })
        .attr("cy", function(d) { return yr2(d.r2_SUB); })


        var svg4 = d3.select("#r2SelContainer").append("svg")
        .attr("width", w3 + margin.left + margin.right)
        .attr("height", h3 + margin.top + margin.bottom)
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

        svg4.append("g")
        .attr("class", "axis")
        .attr("transform", "translate(0," + h3 + ")")
        .call(xAxis_r2)
        .append("text")
        .attr("class", "label")
        .attr("x", w3)
        .attr("y", -6)
        .style("text-anchor", "end")
        .text("R2 LN (max diff)");

        svg4.append("g")
        .attr("class", "axis")
        .call(yAxis_r2)
        .append("text")
        .attr("class", "label")
        .attr("transform", "rotate(-90)")
        .attr("y", 6)
        .attr("dy", ".71em")
        .style("text-anchor", "end")
        .text("R2 Sub (max diff)")

        svg4.selectAll(".dot_sel")
        .data(fit.cellCenters)
        .enter().append("circle")
        .attr("class", "dot_sel")
        .attr("r", 4)
        .attr("cx", function(d) { return xr2(d.r2_LN_SEL); })
        .attr("cy", function(d) { return yr2(d.r2_SUB_SEL); })


        var diaglinedat = [{x: 0, y: 0},{x: 0.5, y: 0.5}];

        var mkdiagline = d3.svg.line()
        .x(function(d) {return xr2(d.x);})
        .y(function(d) {return yr2(d.y);})
        .interpolate("monotone"); 

        svg3.selectAll(".diagline")
        .data([diaglinedat])
        .enter().append("path")
        .attr("class","diagline")
        .attr("d",mkdiagline);

        svg4.selectAll(".diagline")
        .data([diaglinedat])
        .enter().append("path")
        .attr("class","diagline")
        .attr("d",mkdiagline);

      }

      d3.select("#mainGraphContainer").on("mousemove",mmove)

      function mmove(d) {
        var tmp = d3.mouse(this);
        var xPos = x.invert((tmp[0]-trans[0])/scale);
        var yPos = y.invert((tmp[1]-trans[1])/scale);
      }

      function mover(d) {

        if (Session.equals("fit_type","greedy")) {

        // copy the nonlinearity data and add one additional line
        var nonlinstmp = nonlins.slice(0);
        var nonlinsadd = new Array();
        for (var j = 0; j < 8; j++)
          {nonlinsadd.push({x: fit.cellCenters[d.cell_id].f[j].x, y: fit.cellCenters[d.cell_id].f[j].y})}
        nonlinstmp.push(nonlinsadd);

        // add line for the highlighted cell
        var path = nonlinAll.selectAll(".nonlin")
        .data(nonlinstmp)
        .enter()
        .append("path")
        .attr("class","nonlin")
        .attr("d",line)
        .style("stroke-width", 4)
        .style("stroke", "red")
        .style("opacity",1)

        d3.selectAll("circle.dot").classed("active",function(p, i) {return (i == d.cell_id); });
        d3.selectAll("circle.dot_sel").classed("active",function(p, i) {return (i == d.cell_id); });

      }

        var short = d3.format(".3g");

        $("#pop-up").fadeOut(100,function () {
              // Popup content
              //$("#pop-up-title").html("M: text ");
              $("#pop-img").html("RGC# "+d.rgc_id);
              $("#pop-desc").html("R2 sub: "+short(d.r2_SUB)+"<br> R2 LN: "+short(d.r2_LN));
              //$("#pop-desc").html("M+T: text text test");

              // Popup position
              $("#pop-up").fadeIn(100);
            });

        $("#staContainer").fadeOut(100,function() {
          var baseURL = "../pngs/";
          d3.select("#staContainer").selectAll(".sta_img").remove()
          d3.select("#staContainer").selectAll(".sta_img")
          .data([d])
          .enter().append("img")
          .attr("class","sta_img")
          .attr("src", function(d) { return baseURL+ data_set + "/" + d.rgc_id + ".png"; })
          .attr("width", (d.rf_x_px*8))
          .attr("height", (d.rf_y_px*8))

          $("#staContainer").fadeIn(100); 
        });

      }

      function mout(d) {

        d3.select(this).attr("fill","url(#ten1)");
        
        console.log(nonlins.length)
        var path = nonlinAll.selectAll(".nonlin")
        .data(nonlins)
        .exit().transition().duration(100).style("opacity",0).remove()
        
        d3.selectAll("circle.dot").classed("active",0);
        d3.selectAll("circle.dot_sel").classed("active",0);

        $("#pop-up").fadeOut(50);
        $("#staContainer").fadeOut(50);
      }


    }

    d3.json("../subunits-08-03-2013.json", function(d) {
      data = d;
      if (DataDB.find().count() < 1)
        {getFields()};
      update();
    })

  }

}

if (Meteor.isServer) {
  Meteor.startup(function () {

  });

}


function getlinks(data) {
  var i, n = data.links.length;

  for(i = 0; i < n; ++i) {
    data.links[i].source = data.cellCenters[data.links[i].source_cell].subCenters[data.links[i].source_sub];
    data.links[i].target = data // get the target based on the cell
    .cellCenters[data.links[i].target_cell];
  };
  return data;
}

// get convex hulls for each subunit

function getsubpaths(data) {
  var i, out = [];

  duh = collapse(d3.nest().key(function(d) {
    return d.cell_id;
  }).key(function(d) {
    return d.sub_id;
  }).entries(data.cones));

  duh.forEach(function(d) {
    out.push(groupPath(d));
  })
  data.subPaths = out;

  return data
}


// create colors for subunit weights

function clrs(i, j) {
  clr_list = [
    [0, 0, 0],
    [255, 255, 255],
    [204, 82, 82],
    [204, 163, 82],
    [163, 204, 82],
    [82, 204, 82],
    [82, 204, 163],
    [82, 163, 204],
    [82, 82, 204],
    [163, 82, 204],
    [204, 82, 163],
    [204, 82, 82]
  ];
  var tmp = clr_list[i];
  var foo = d3.rgb(tmp[0], tmp[1], tmp[2])
  return d3.rgb(tmp[0], tmp[1], tmp[2]).darker(2.5).brighter(j * 5);
}


// collapse the first two levels of a hierarchy

function collapse(d) {
  var out = [];
  // should make this recursive...
  d.forEach(function(d) {
    d.values.forEach(function(d) {
      out.push(d);
    })
  })
  return out
}

// get unique elements

function unique(d) {
  var o = {},
    i, l = d.length,
    r = [];
  for(i = 0; i < l; i += 1) o[d[i]] = d[i];
  for(i in o) r.push(o[i]);
  return r;
};
