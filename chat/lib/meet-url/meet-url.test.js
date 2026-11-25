(function () {
  var test = DimTest.test;
  var expect = DimTest.expect;

  test("meet-url toLocation / fromLocation round-trip", async function () {
    var meetUrl = await BP.require("chat/lib/meet-url");

    expect(meetUrl.toLocation({})).toBe("/pair");
    expect(meetUrl.toLocation({ screen: "pair" })).toBe("/pair");
    expect(meetUrl.toLocation({ screen: "chat" })).toBe("/chat");
    expect(meetUrl.toLocation({ screen: "profile" })).toBe("/profile");
    expect(meetUrl.toLocation({ screen: "contact" })).toBe("/contact");
    expect(meetUrl.toLocation({ screen: "unknown" })).toBe("/pair");

    expect(meetUrl.fromLocation("/").screen).toBe("pair");
    expect(meetUrl.fromLocation("/pair").screen).toBe("pair");
    expect(meetUrl.fromLocation("/chat").screen).toBe("chat");
    expect(meetUrl.fromLocation("/profile").screen).toBe("profile");
    expect(meetUrl.fromLocation("/contact").screen).toBe("contact");
    expect(meetUrl.fromLocation("/unknown/shape").screen).toBe(null);
    expect(meetUrl.fromLocation("#/chat").screen).toBe("chat");

    var loc = meetUrl.fromLocation(
      meetUrl.toLocation({ screen: "profile" }),
    );
    expect(loc.screen).toBe("profile");
  });
})();
