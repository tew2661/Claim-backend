import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt'; // Import Strategy from passport-jwt
import { ExtractJwt } from 'passport-jwt';

export interface JwtPayload {
  username: string;
  sub: number; // User ID
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.NEST_JWT_SECRET, // Replace with your actual secret
    });
  }

  async validate(payload: JwtPayload) {
    // Here, payload will have the decoded JWT token
    return { userId: payload.sub, username: payload.username };
  }
}
