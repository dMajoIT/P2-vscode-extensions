' comment - single line
'' doc comment - single line

{
comment block
}

{{
    doc comment block
}}

CON { this is our con section }
    DIGIT_NOVALUE = -2   ' digit value when NOT [0-9]  (semantic bad, should be constant!)

#0, ST_UNKNOWN, ST_FORWARD, ST_REVERSE

    MAX_DIGITS = 6

    SIGN_SHIFT = 31
    EXP_OFFSET = 127         ' offset for exponent field
    EXP_SHIFT  = 23          ' shift for reading the exponent field
    MAX_EXP    = 255
    EXP_MASK   = MAX_EXP
    MIN_SIG    = $800_000       ' smallest significand
    FIRST_STATE = ST_FORWARD

OBJ { Objects Used by this Object }

    screen                      : "isp_hub75_screenAccess"
    pixels                      : "isp_hub75_screenUtils"
    color                       : "isp_hub75_color"
    digit[color.NBR_DIGITS]     : "isp_hub75_7seg"
    digitTens[color.MAX_DIGITS]     : "isp_hub75_7seg"

DAT
    strings1      byte  "string",0

PUB getServerStatus(x, y): server, port, ssl, ca | temp  ' <<<< -- more than 1 return value not allows in spin1!  RED?!!!
    unpack(5)
    getServerStatus(5, 4)

    digit[1].draw()

    ca := 5
    temp := x

PRI Unpack(x) : s | shift, exp_fixup, e, b
  s := x>>31
  e := (x>>EXP_SHIFT) & EXP_MASK
  b := x & ((1<<EXP_SHIFT)-1)
  ' handle denormalized numbers
  if e == 0
    if b <> 0
      e := 1  ' denormalized number
  elseif e <> MAX_EXP
    b |= MIN_SIG  ' restore implied bit
