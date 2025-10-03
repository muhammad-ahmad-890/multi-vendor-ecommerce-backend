import createError from "http-errors";
import jwt from "jsonwebtoken"

export function authGuard(role){
    return (req, res, next)=>{
        try{
            const token = req.header("Authorization");
            console.log("🚀 ~ authGuard ~ token:", token)
            if(!token)
                throw new Error("Authorization Token doesn't Exist")

            const jwtToken = token.split(' ')[1];

            const payload = jwt.verify(jwtToken, process.env.JWT_AUTHENTICATION_SECRET);
        console.log(payload,"payload")
        if( role != "all" && payload.role !== role)
                throw new Error("You don't have access to " + role + " role")

            req.user = payload.user;

            next();
        }
        catch(err){
            let error = new createError.Unauthorized(err.message)
            next(error)
        }
    }
}